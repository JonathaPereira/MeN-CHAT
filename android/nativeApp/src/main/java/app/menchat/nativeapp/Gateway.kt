package app.menchat.nativeapp

import java.io.File
import java.util.concurrent.TimeUnit
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

internal data class PublicConfig(
    val url: String,
    val key: String,
    val firebase: FirebaseRuntime? = null,
    val nativePushReady: Boolean = false,
    val callsReady: Boolean = false,
) {
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
            return PublicConfig(
                url.toString().trimEnd('/'),
                key,
                FirebaseRuntime.parse(data.optJSONObject("firebase")),
                data.optBoolean("nativePushReady"),
                data.optBoolean("callsReady"),
            )
        }
    }
}

internal data class PreparedVoice(
    val id: String,
    val path: String,
    val bucket: String = "menchat-media",
)

internal class Gateway(
    private val client: OkHttpClient =
        OkHttpClient.Builder()
            .followRedirects(false)
            .followSslRedirects(false)
            .callTimeout(25, TimeUnit.SECONDS)
            .build(),
    private var config: PublicConfig? = null,
    private val clock: () -> Long = { System.currentTimeMillis() / 1000 },
    private val siteOrigin: String = "https://men-chat.vercel.app",
) {
    @Volatile var credentials: Credentials? = null
    var onCredentials: (Credentials) -> Unit = {}
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    private fun configured(): PublicConfig {
        config?.let {
            return it
        }
        val request = Request.Builder().url(siteOrigin + "/api/mobile/config").get().build()
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
                        if (
                            method in listOf("POST", "PUT", "PATCH") ||
                                (method == "DELETE" && body != null)
                        )
                            (body ?: JSONObject()).toString().toRequestBody(jsonType)
                        else null,
                    )
                }
                .build()
        return client.newCall(request).execute().use { response ->
            val text = response.body?.string() ?: ""
            if (!response.isSuccessful) {
                val remote = runCatching { JSONObject(text).optString("message") }.getOrDefault("")
                val message =
                    if (remote.contains("500 MB"))
                        "O armazenamento do MenChat está cheio. Novos anexos estão bloqueados. Avise o administrador."
                    else if (remote.contains("100 MB"))
                        "Você atingiu o limite de 100 MB de envios nas últimas 24 horas."
                    else if (remote.contains("pendentes"))
                        "Há anexos pendentes. Conclua ou descarte suas tentativas anteriores."
                    else
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
                    "select" to
                        "id,display_name,user_code,status_message,avatar_path,show_code,allow_code_lookup,read_receipts,show_typing,app_role",
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
                it.optional("avatar_path"),
                it.optBoolean("show_code", true),
                it.optBoolean("allow_code_lookup", true),
                it.optBoolean("read_receipts", true),
                it.optBoolean("show_typing", true),
                it.optString("app_role") == "admin",
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
                it.optional("avatar_path"),
                it.optional("creator_id"),
                it.optional("owner_id"),
                it.optional("last_sender"),
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
                it.optString("role", "member"),
                it.optString("status"),
                it.optional("avatar_path"),
                it.optional("code"),
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
        mentions: Set<String> = emptySet(),
    ): Message =
        JSONObject(
                rpc(
                    "menchat_send_composed",
                    JSONObject()
                        .put("p_id", id)
                        .put("p_thread", thread)
                        .put("p_body", text)
                        .put("p_reply", reply ?: JSONObject.NULL)
                        .put("p_mentions", JSONArray(mentions.sorted()))
                        .put("p_upload", upload ?: JSONObject.NULL),
                )
            )
            .message()

    fun openPrivate(code: String): String {
        require(Regex("[A-Z0-9]{6}").matches(code)) { "Use o código de seis letras/números." }
        return rpc("menchat_open_private", JSONObject().put("p_code", code)).trim('"')
    }

    fun createGroup(name: String, codes: List<String> = emptyList()): String {
        require(
            name.isNotBlank() &&
                name.length <= 60 &&
                codes.size <= 19 &&
                codes.all { Regex("[A-Z0-9]{6}").matches(it) }
        ) {
            "Confira o nome e os códigos do grupo."
        }
        return rpc(
                "menchat_create_group",
                JSONObject().put("p_name", name.trim()).put("p_codes", JSONArray(codes)),
            )
            .trim('"')
    }

    fun delete(id: String, everyone: Boolean) {
        rpc("menchat_delete_message", JSONObject().put("p_id", id).put("p_everyone", everyone))
    }

    fun media(id: String): Media {
        val value =
            table("menchat_uploads", mapOf("id" to "eq.$id", "select" to "*")).getJSONObject(0)
        return Media(
            id,
            value.getString("path"),
            value.getString("kind"),
            value.getString("mime"),
            value.getString("name"),
            value.getLong("bytes"),
            value.optBoolean("is_sticker"),
        )
    }

    fun signed(media: Media): String = signedPath("menchat-media", media.path)

    fun avatarUrl(path: String): String = signedPath("menchat-avatars", path)

    private fun signedPath(bucket: String, path: String): String {
        val cfg = configured()
        val result =
            JSONObject(
                raw(
                    "/storage/v1/object/sign/$bucket/$path",
                    "POST",
                    JSONObject().put("expiresIn", 300),
                    token = token(),
                )
            )
        val uri = result.optional("signedURL") ?: result.getString("signedUrl")
        val url =
            if (uri.startsWith("/storage/v1/")) cfg.url + uri
            else if (uri.startsWith("/")) cfg.url + "/storage/v1" + uri else uri
        val parsed = url.toHttpUrl()
        val base = cfg.url.toHttpUrl()
        require(
            parsed.scheme == base.scheme &&
                parsed.host == base.host &&
                parsed.port == base.port &&
                parsed.username.isEmpty() &&
                parsed.password.isEmpty()
        )
        return url
    }

    fun reserveVoice(thread: String, file: File) =
        reserveFile(thread, LocalAttachment(file, file.name, "audio/mp4", "audio"))

    fun uploadVoice(item: PreparedVoice, file: File) =
        uploadFile(item, LocalAttachment(file, file.name, "audio/mp4", "audio"))

    fun reserveFile(thread: String?, file: LocalAttachment): PreparedVoice {
        if (thread == null)
            require(file.kind == "avatar" && file.mime == "image/webp" && file.bytes in 1..200_000)
        else NativeMediaPolicy.check(file.name, file.mime, file.bytes)
        val row =
            JSONArray(
                    rpc(
                        if (file.sticker) "menchat_reserve_sticker" else "menchat_reserve_upload",
                        JSONObject()
                            .put("p_thread", thread ?: JSONObject.NULL)
                            .put("p_name", file.name)
                            .apply { if (!file.sticker) put("p_mime", file.mime) }
                            .put("p_bytes", file.bytes),
                    )
                )
                .getJSONObject(0)
        return PreparedVoice(
            row.getString("id"),
            row.getString("path"),
            if (thread == null) "menchat-avatars" else "menchat-media",
        )
    }

    fun uploadFile(item: PreparedVoice, file: LocalAttachment) {
        val cfg = configured()
        require(item.bucket in listOf("menchat-media", "menchat-avatars"))
        val request =
            Request.Builder()
                .url(cfg.url + "/storage/v1/object/" + item.bucket + "/" + item.path)
                .header("apikey", cfg.key)
                .header("Authorization", "Bearer ${token()}")
                .header("x-upsert", "false")
                .header("cache-control", "0")
                .post(file.file.asRequestBody(file.mime.toMediaType()))
                .build()
        client.newCall(request).execute().use {
            if (!it.isSuccessful) {
                val details = runCatching { JSONObject(it.body?.string() ?: "{}") }.getOrNull()
                val duplicate =
                    it.code == 409 ||
                        (it.code == 400 &&
                            (details?.optString("statusCode") == "409" ||
                                details?.optString("error") == "Duplicate"))
                if (!duplicate)
                    throw NativeApiException(
                        it.code,
                        safeApiCode(details?.optString("code")),
                        if (it.code == 403) "Sem permissão para enviar este arquivo."
                        else if (it.code == 402)
                            "Armazenamento limitado pelo provedor. Avise o administrador."
                        else "Falha ao anexar o arquivo. Tente novamente.",
                    )
            }
        }
    }

    fun discardFile(item: PreparedVoice) {
        raw(
            "/storage/v1/object/${item.bucket}",
            "DELETE",
            JSONObject().put("prefixes", JSONArray().put(item.path)),
            token = token(),
        )
        rpc("menchat_cancel_upload", JSONObject().put("p_upload", item.id))
    }

    fun findSent(id: String, thread: String): Message? =
        table(
                "menchat_messages",
                mapOf(
                    "id" to "eq.$id",
                    "thread_id" to "eq.$thread",
                    "select" to "*",
                    "limit" to "1",
                ),
            )
            .objects()
            .firstOrNull()
            ?.message()

    fun retireAvatar(actor: String, path: String) {
        val row =
            table(
                    "menchat_uploads",
                    mapOf(
                        "owner_id" to "eq.$actor",
                        "path" to "eq.$path",
                        "kind" to "eq.avatar",
                        "select" to "id,path",
                    ),
                )
                .objects()
                .firstOrNull() ?: return
        discardFile(PreparedVoice(row.getString("id"), row.getString("path"), "menchat-avatars"))
    }

    fun saveProfile(draft: ProfileDraft, avatar: String?) {
        require(draft.name.trim().length in 1..50 && draft.status.length <= 140) {
            "Nome: até 50 caracteres. Status: até 140."
        }
        rpc(
            "menchat_save_profile",
            JSONObject()
                .put("p_name", draft.name.trim())
                .put("p_status", draft.status)
                .put("p_show_code", draft.showCode)
                .put("p_lookup", draft.lookup)
                .put("p_read", draft.readReceipts)
                .put("p_typing", draft.showTyping)
                .put("p_avatar", avatar ?: JSONObject.NULL)
                .put("p_remove", draft.removePhoto),
        )
    }

    fun manageGroup(
        thread: String,
        action: String,
        user: String? = null,
        code: String? = null,
        name: String? = null,
    ) {
        require(
            action in listOf("rename", "add", "remove", "promote", "demote", "transfer", "leave")
        )
        require(
            rpc(
                "menchat_manage_group",
                JSONObject()
                    .put("p_thread", thread)
                    .put("p_action", action)
                    .put("p_user", user ?: JSONObject.NULL)
                    .put("p_code", code ?: JSONObject.NULL)
                    .put("p_name", name ?: JSONObject.NULL),
            ) == "true"
        ) {
            "Não foi possível atualizar o grupo. Confira o código, seu papel e as regras do criador."
        }
    }

    fun starred(thread: String): Set<String> =
        JSONArray(rpc("menchat_starred", JSONObject().put("p_thread", thread))).let { array ->
            (0 until array.length()).map { array.getString(it) }.toSet()
        }

    fun star(id: String, value: Boolean) {
        rpc("menchat_star_message", JSONObject().put("p_id", id).put("p_star", value))
    }

    fun favoriteMessages(thread: String, ids: Set<String>): List<Message> =
        if (ids.isEmpty()) emptyList()
        else
            table(
                    "menchat_messages",
                    mapOf(
                        "thread_id" to "eq.$thread",
                        "id" to "in.(${ids.take(200).joinToString(",")})",
                        "select" to "*",
                        "order" to "seq.desc",
                        "limit" to "200",
                    ),
                )
                .objects()
                .map { it.message() }
                .filter { !it.deleted }

    fun invitations(): List<NativeInvitation> =
        JSONArray(rpc("menchat_list_invites")).objects().map {
            NativeInvitation(
                it.getString("id"),
                it.getString("email"),
                it.getString("expires_at"),
                it.getString("state"),
            )
        }

    fun revokeInvitation(id: String) {
        require(rpc("menchat_revoke_invite", JSONObject().put("p_id", id)) == "true") {
            "Convite indisponível ou já utilizado."
        }
    }

    fun createInvitation(email: String): String =
        mobile("/api/mobile/invitations", JSONObject().put("email", email)).getString("url")

    fun publicConfiguration() = configured()

    fun mobile(path: String, body: JSONObject? = null): JSONObject {
        require(path.startsWith("/api/mobile/"))
        val request =
            Request.Builder()
                .url(siteOrigin + path)
                .header("Authorization", "Bearer ${token()}")
                .header("Cache-Control", "no-store")
                .apply { if (body != null) post(body.toString().toRequestBody(jsonType)) }
                .build()
        return client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful)
                throw NativeApiException(
                    response.code,
                    null,
                    when (response.code) {
                        401 -> "Entre novamente para continuar."
                        403 -> "Você não tem permissão para esta ação."
                        409 ->
                            "Ação indisponível. Confira o limite de pessoas e os convites existentes."
                        429 -> "Muitas tentativas. Aguarde."
                        else -> "Recurso indisponível. Confira a configuração do servidor."
                    },
                )
            if (raw.isBlank()) JSONObject() else JSONObject(raw)
        }
    }
}
