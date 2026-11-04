package app.menchat.nativeapp

import java.io.File
import java.util.concurrent.TimeUnit
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

internal data class PublicConfig(val url: String, val key: String) {
    companion object {
        fun parse(data: JSONObject): PublicConfig {
            val url = data.getString("url").toHttpUrl()
            require(
                url.isHttps &&
                    url.username.isEmpty() &&
                    url.password.isEmpty() &&
                    url.encodedPath == "/" &&
                    url.query == null &&
                    url.fragment == null
            )
            val key = data.getString("publishableKey")
            require(Regex("sb_publishable_[A-Za-z0-9_-]+").matches(key))
            return PublicConfig(url.toString().trimEnd('/'), key)
        }
    }
}

internal data class PreparedVoice(val id: String, val path: String)

internal class Gateway(
    private val client: OkHttpClient =
        OkHttpClient.Builder()
            .followRedirects(false)
            .followSslRedirects(false)
            .callTimeout(25, TimeUnit.SECONDS)
            .build(),
    private var config: PublicConfig? = null,
    private val clock: () -> Long = { System.currentTimeMillis() / 1000 },
) {
    @Volatile var credentials: Credentials? = null
    var onCredentials: (Credentials) -> Unit = {}
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    private fun configured(): PublicConfig {
        config?.let {
            return it
        }
        val request =
            Request.Builder().url("https://men-chat.vercel.app/api/mobile/config").get().build()
        val data =
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful)
                    throw IllegalStateException(
                        "Não foi possível configurar a conexão. Tente novamente mais tarde."
                    )
                JSONObject(response.body?.string() ?: "{}")
            }
        return PublicConfig.parse(data).also { config = it }
    }

    private fun raw(
        path: String,
        method: String = "GET",
        body: JSONObject? = null,
        query: Map<String, String> = emptyMap(),
        token: String? = null,
    ): String {
        val cfg = configured()
        val url =
            (cfg.url + path)
                .toHttpUrl()
                .newBuilder()
                .apply { query.forEach { (k, v) -> addQueryParameter(k, v) } }
                .build()
        val request =
            Request.Builder()
                .url(url)
                .header("apikey", cfg.key)
                .header("Cache-Control", "no-store")
                .apply {
                    if (token != null) header("Authorization", "Bearer $token")
                    method(
                        method,
                        if (method in listOf("POST", "PUT", "PATCH"))
                            (body ?: JSONObject()).toString().toRequestBody(jsonType)
                        else null,
                    )
                }
                .build()
        return client.newCall(request).execute().use { response ->
            val text = response.body?.string() ?: ""
            if (!response.isSuccessful) {
                val message =
                    when (response.code) {
                        401 -> "Sessão expirada ou e-mail/senha incorretos. Entre novamente."
                        403 -> "Acesso não permitido. Confira sua participação na conversa."
                        429 -> "Muitas tentativas. Aguarde um pouco."
                        413 -> "O arquivo ultrapassou o limite permitido."
                        else ->
                            "Não foi possível concluir. Confira a conexão, os dados e suas permissões."
                    }
                val apiCode = runCatching { JSONObject(text).optString("code") }.getOrNull()
                throw NativeApiException(response.code, safeApiCode(apiCode), message)
            }
            text
        }
    }

    private fun session(data: JSONObject, persist: Boolean = true): Credentials {
        val value =
            Credentials(
                data.getString("access_token"),
                data.getString("refresh_token"),
                data.optLong("expires_at", clock() + data.optLong("expires_in", 3600)),
            )
        // Store the rotated refresh token before issuing another authenticated request.
        if (persist) onCredentials(value)
        credentials = value
        return value
    }

    @Synchronized
    private fun token(): String {
        val value = credentials ?: error("Entre na sua conta.")
        if (value.expires <= clock() + 60) {
            session(
                JSONObject(
                    raw(
                        "/auth/v1/token",
                        "POST",
                        JSONObject().put("refresh_token", value.refresh),
                        mapOf("grant_type" to "refresh_token"),
                    )
                )
            )
        }
        return credentials!!.access
    }

    @Synchronized
    fun login(email: String, password: String): Account {
        require(
            email.length <= 254 &&
                email.contains("@") &&
                password.isNotBlank() &&
                password.toByteArray(Charsets.UTF_8).size <= 72
        ) {
            "Preencha e-mail e senha."
        }
        session(
            JSONObject(
                raw(
                    "/auth/v1/token",
                    "POST",
                    JSONObject().put("email", email.trim()).put("password", password),
                    mapOf("grant_type" to "password"),
                )
            ),
            persist = false,
        )
        try {
            return account().also { onCredentials(credentials!!) }
        } catch (error: Exception) {
            credentials = null
            throw error
        }
    }

    fun account(): Account {
        val user = JSONObject(raw("/auth/v1/user", token = token()))
        require(user.optional("email_confirmed_at") != null) {
            "Verifique seu e-mail antes de entrar."
        }
        val id = user.getString("id")
        val rows =
            table(
                "menchat_profiles",
                mapOf(
                    "id" to "eq.$id",
                    "account_status" to "eq.active",
                    "select" to "id,display_name,user_code,status_message",
                ),
            )
        require(rows.length() == 1 && rows.getJSONObject(0).getString("id") == id) {
            "Sua conta ainda não tem acesso ativo. Aguarde o administrador."
        }
        return rows.getJSONObject(0).let {
            Account(
                id,
                it.getString("display_name"),
                it.getString("user_code"),
                it.optString("status_message"),
            )
        }
    }

    @Synchronized
    fun logout() {
        try {
            raw("/auth/v1/logout", "POST", query = mapOf("scope" to "local"), token = token())
        } finally {
            credentials = null
        }
    }

    fun rpc(name: String, data: JSONObject = JSONObject()): String =
        raw("/rest/v1/rpc/$name", "POST", data, token = token())

    fun table(name: String, query: Map<String, String>): JSONArray =
        JSONArray(raw("/rest/v1/$name", query = query, token = token()))

    fun conversations(): List<Conversation> =
        JSONArray(rpc("menchat_inbox")).objects().map {
            Conversation(
                it.getString("id"),
                it.getString("name"),
                it.optString("kind") == "group",
                it.optBoolean("can_send"),
                it.optional("last_body") ?: "Comece a conversar",
                it.optInt("unread_count"),
                it.optional("last_at"),
            )
        }

    fun messages(thread: String, after: Long? = null, before: Long? = null): List<Message> {
        val query =
            mutableMapOf(
                "thread_id" to "eq.$thread",
                "select" to "*",
                "order" to "seq.desc",
                "limit" to "100",
            )
        if (after != null) {
            query["seq"] = "gt.$after"
            query["order"] = "seq.asc"
        }
        if (before != null) query["seq"] = "lt.$before"
        val rows = table("menchat_messages", query).objects().map { it.message() }
        return if (after == null) rows.reversed() else rows
    }

    fun reconcile(thread: String, messages: List<Message>): List<Message> {
        val visible = mutableMapOf<String, Boolean>()
        messages
            .map { it.id }
            .chunked(200)
            .forEach { part ->
                table(
                        "menchat_messages",
                        mapOf(
                            "thread_id" to "eq.$thread",
                            "id" to "in.(${part.joinToString(",")})",
                            "select" to "id,deleted_at",
                        ),
                    )
                    .objects()
                    .forEach { visible[it.getString("id")] = it.optional("deleted_at") != null }
            }
        return messages
            .filter { visible.containsKey(it.id) }
            .map {
                if (visible[it.id] == true)
                    it.copy(
                        text = "Mensagem apagada.",
                        attachment = null,
                        deleted = true,
                        reply = null,
                    )
                else it
            }
    }

    fun people(thread: String): List<Person> =
        JSONArray(rpc("menchat_participants", JSONObject().put("p_thread", thread))).objects().map {
            Person(
                it.getString("id"),
                it.getString("name"),
                it.optBoolean("is_typing"),
                it.optLong("received_seq"),
                if (it.isNull("read_seq")) null else it.optLong("read_seq"),
            )
        }

    fun seen(thread: String, seq: Long) {
        rpc("menchat_seen", JSONObject().put("p_thread", thread).put("p_seq", seq))
        rpc(
            "menchat_touch",
            JSONObject()
                .put("p_thread", thread)
                .put("p_received", seq)
                .put("p_read", seq)
                .put("p_typing", false),
        )
    }

    fun typing(thread: String, seq: Long, value: Boolean) {
        rpc(
            "menchat_touch",
            JSONObject()
                .put("p_thread", thread)
                .put("p_received", seq)
                .put("p_read", 0)
                .put("p_typing", value),
        )
    }

    fun send(
        id: String,
        thread: String,
        text: String,
        upload: String? = null,
        reply: String? = null,
    ): Message =
        JSONObject(
                rpc(
                    "menchat_send_composed",
                    JSONObject()
                        .put("p_id", id)
                        .put("p_thread", thread)
                        .put("p_body", text)
                        .put("p_reply", reply ?: JSONObject.NULL)
                        .put("p_mentions", JSONArray())
                        .put("p_upload", upload ?: JSONObject.NULL),
                )
            )
            .message()

    fun openPrivate(code: String): String {
        require(Regex("[A-Z0-9]{6}").matches(code)) { "Use o código de seis letras/números." }
        return rpc("menchat_open_private", JSONObject().put("p_code", code)).trim('"')
    }

    fun createGroup(name: String): String {
        require(name.isNotBlank() && name.length <= 80)
        return rpc(
                "menchat_create_group",
                JSONObject().put("p_name", name.trim()).put("p_codes", JSONArray()),
            )
            .trim('"')
    }

    fun delete(id: String, everyone: Boolean) {
        rpc("menchat_delete_message", JSONObject().put("p_id", id).put("p_everyone", everyone))
    }

    fun media(id: String): Media {
        val value =
            table(
                    "menchat_uploads",
                    mapOf("id" to "eq.$id", "select" to "id,path,kind,mime,name,bytes"),
                )
                .getJSONObject(0)
        return Media(
            id,
            value.getString("path"),
            value.getString("kind"),
            value.getString("mime"),
            value.getString("name"),
            value.getLong("bytes"),
        )
    }

    fun signed(media: Media): String {
        val cfg = configured()
        val result =
            JSONObject(
                raw(
                    "/storage/v1/object/sign/menchat-media/${media.path}",
                    "POST",
                    JSONObject().put("expiresIn", 300),
                    token = token(),
                )
            )
        val uri = (result.optional("signedURL") ?: result.getString("signedUrl"))
        val url = if (uri.startsWith("/")) cfg.url + "/storage/v1" + uri else uri
        require(url.toHttpUrl().host == cfg.url.toHttpUrl().host && url.toHttpUrl().isHttps)
        return url
    }

    fun reserveVoice(thread: String, file: File): PreparedVoice {
        require(file.length() in 1..10_000_000) { "Áudio vazio ou maior que 10 MB." }
        val row =
            JSONArray(
                    rpc(
                        "menchat_reserve_upload",
                        JSONObject()
                            .put("p_thread", thread)
                            .put("p_name", file.name)
                            .put("p_mime", "audio/mp4")
                            .put("p_bytes", file.length()),
                    )
                )
                .getJSONObject(0)
        return PreparedVoice(row.getString("id"), row.getString("path"))
    }

    fun uploadVoice(item: PreparedVoice, file: File) {
        val cfg = configured()
        val request =
            Request.Builder()
                .url(cfg.url + "/storage/v1/object/menchat-media/" + item.path)
                .header("apikey", cfg.key)
                .header("Authorization", "Bearer ${token()}")
                .header("x-upsert", "false")
                .post(file.readBytes().toRequestBody("audio/mp4".toMediaType()))
                .build()
        client.newCall(request).execute().use {
            if (!it.isSuccessful) {
                // Storage may return HTTP 400 with statusCode 409 after a lost response.
                // The final RPC still verifies ownership, size and MIME before publishing.
                val details = runCatching { JSONObject(it.body?.string() ?: "{}") }.getOrNull()
                val duplicate =
                    it.code == 409 ||
                        (it.code == 400 &&
                            (details?.optString("statusCode") == "409" ||
                                details?.optString("error") == "Duplicate"))
                if (!duplicate) error("Falha ao anexar áudio. Tente novamente.")
            }
        }
    }
}
