package app.menchat.nativeapp

import android.os.Looper
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.flow.MutableStateFlow
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.*
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.util.ReflectionHelpers

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MediaModelTest {
    private lateinit var server: MockWebServer
    private lateinit var model: MainModel
    private lateinit var mutable: MutableStateFlow<NativeState>
    private val actor = "10000000-0000-4000-8000-000000000001"
    private val thread = "20000000-0000-4000-8000-000000000001"
    private val requests = CopyOnWriteArrayList<RecordedRequest>()
    private var respond: (RecordedRequest) -> MockResponse = { MockResponse().setBody("[]") }

    private fun json(body: String, code: Int = 200) =
        MockResponse()
            .setResponseCode(code)
            .setBody(body)
            .addHeader("Content-Type", "application/json")

    @Before
    fun setup() {
        server =
            MockWebServer().apply {
                dispatcher =
                    object : Dispatcher() {
                        override fun dispatch(request: RecordedRequest): MockResponse {
                            requests += request
                            return respond(request)
                        }
                    }
                start()
            }
        val gateway =
            Gateway(
                    OkHttpClient(),
                    PublicConfig(server.url("/").toString().trimEnd('/'), "sb_publishable_fixture"),
                    { 1000 },
                )
                .apply { credentials = Credentials("actor-token", "refresh", 9000) }
        model = MainModel(RuntimeEnvironment.getApplication(), gateway)
        mutable = ReflectionHelpers.getField(model, "mutable")
        mutable.value =
            NativeState(
                account =
                    Account(
                        actor,
                        "Pessoa",
                        "AB123C",
                        "Oi",
                        showCode = false,
                        lookup = false,
                        readReceipts = false,
                        showTyping = false,
                    ),
                selected = Conversation(thread, "Contato", false, true, "", 0),
            )
    }

    @After
    fun close() {
        mutable.value.attachment?.file?.delete()
        mutable.value.profile?.photo?.file?.delete()
        server.shutdown()
    }

    private fun settle() {
        val end = System.nanoTime() + 10_000_000_000
        do {
            shadowOf(Looper.getMainLooper()).idle()
            if (!model.state.value.busy) return
            Thread.sleep(5)
        } while (System.nanoTime() < end)
        fail("A operação não concluiu")
    }

    private fun file(kind: String = "document") =
        LocalAttachment(
            File.createTempFile("draft-test", if (kind == "avatar") ".webp" else ".pdf").apply {
                writeText("fixture")
            },
            if (kind == "avatar") "perfil.webp" else "arquivo.pdf",
            if (kind == "avatar") "image/webp" else "application/pdf",
            kind,
        )

    private fun syncResponse(request: RecordedRequest, row: String = "[]"): MockResponse =
        when {
            request.path == "/rest/v1/rpc/menchat_list_chats" ->
                json(
                    """[{"id":"$thread","name":"Contato","kind":"private","can_send":true,"unread_count":0}]"""
                )
            request.path == "/rest/v1/rpc/menchat_participants" -> json("[]")
            request.requestUrl!!.queryParameter("select") == "id,deleted_at" ->
                json(
                    if (row == "[]") "[]"
                    else
                        """[{"id":"${JSONObject(row.removePrefix("[").removeSuffix("]")).getString("id")}","deleted_at":null}]"""
                )
            else -> json(row)
        }

    private fun retryTest(serverCommitted: Boolean) {
        val draft = file()
        mutable.value = mutable.value.copy(attachment = draft, text = "Legenda")
        var id = ""
        val sends = AtomicInteger()
        val saved = {
            """{"id":"$id","seq":1,"sender_id":"$actor","body":"Legenda","created_at":"2026-11-01T12:00:00Z","attachment_id":"upload","deleted_at":null,"reply_to":null}"""
        }
        respond = { request ->
            when {
                request.path == "/rest/v1/rpc/menchat_reserve_upload" ->
                    json("""[{"id":"upload","path":"$actor/upload","kind":"document"}]""")
                request.path!!.startsWith("/storage/v1/object/") -> json("{}")
                request.path == "/rest/v1/rpc/menchat_send_composed" -> {
                    id = JSONObject(request.body.clone().readUtf8()).getString("p_id")
                    if (sends.incrementAndGet() == 1) json("{}", 500) else json(saved())
                }
                request.requestUrl!!.queryParameter("id") == "eq.$id" ->
                    json(if (serverCommitted) "[${saved()}]" else "[]")
                else -> syncResponse(request, if (id.isBlank()) "[]" else "[${saved()}]")
            }
        }
        model.send()
        settle()
        assertTrue(model.state.value.retrySend)
        assertTrue(draft.file.exists())
        model.text("Outra legenda")
        model.reply(Message("reply", 3, actor, "Outro", "", null, false, null))
        assertEquals("Legenda", model.state.value.text)
        assertNull(model.state.value.reply)
        model.send()
        settle()
        assertNull(model.state.value.error)
        assertFalse(model.state.value.retrySend)
        assertFalse(draft.file.exists())
        assertEquals(1, requests.count { it.path == "/rest/v1/rpc/menchat_reserve_upload" })
        assertEquals(1, requests.count { it.path!!.startsWith("/storage/v1/object/") })
        assertEquals(if (serverCommitted) 1 else 2, sends.get())
        requests
            .filter { it.path == "/rest/v1/rpc/menchat_send_composed" }
            .forEach { request ->
                val data = JSONObject(request.body.clone().readUtf8())
                assertEquals(id, data.getString("p_id"))
                assertEquals("Legenda", data.getString("p_body"))
                assertEquals("upload", data.getString("p_upload"))
            }
    }

    @Test
    fun retryConfirmsPublishedMessageBeforeTouchingStorage() {
        retryTest(true)
    }

    @Test
    fun retryWithoutVisibleMessageReusesPayloadAndSkipsStorage() {
        retryTest(false)
    }

    @Test
    fun profileRetryRetainsUploadAndAllPrivacyChoices() {
        val photo = file("avatar")
        model.text("Meu rascunho")
        model.beginProfile()
        val draft = model.state.value.profile!!
        assertFalse(draft.showCode)
        assertFalse(draft.lookup)
        assertFalse(draft.readReceipts)
        assertFalse(draft.showTyping)
        model.editProfile(draft.copy(name = "Nome novo", photo = photo))
        val saves = AtomicInteger()
        respond = { request ->
            when {
                request.path == "/rest/v1/rpc/menchat_reserve_upload" ->
                    json("""[{"id":"avatar","path":"$actor/avatar","kind":"avatar"}]""")
                request.path!!.startsWith("/storage/v1/object/") -> json("{}")
                request.path == "/rest/v1/rpc/menchat_save_profile" ->
                    if (saves.incrementAndGet() == 1) json("{}", 500) else json("null")
                request.path == "/auth/v1/user" ->
                    json("""{"id":"$actor","email_confirmed_at":"2026-01-01"}""")
                request.path!!.startsWith("/rest/v1/menchat_profiles") ->
                    json(
                        """[{"id":"$actor","display_name":"Nome novo","user_code":"AB123C","status_message":"Oi","avatar_path":"$actor/avatar","show_code":false,"allow_code_lookup":false,"read_receipts":false,"show_typing":false}]"""
                    )
                else -> syncResponse(request)
            }
        }
        model.saveProfile()
        settle()
        assertNotNull(model.state.value.profile)
        assertTrue(photo.file.exists())
        model.saveProfile()
        settle()
        assertNull(model.state.value.error)
        assertNull(model.state.value.profile)
        assertFalse(photo.file.exists())
        assertEquals("Nome novo", model.state.value.account!!.name)
        assertFalse(model.state.value.account!!.showCode)
        assertEquals("Meu rascunho", model.state.value.text)
        assertEquals(1, requests.count { it.path!!.startsWith("/storage/v1/object/") })
        requests
            .filter { it.path == "/rest/v1/rpc/menchat_save_profile" }
            .forEach { assertFalse(JSONObject(it.body.clone().readUtf8()).getBoolean("p_read")) }
    }

    @Test
    fun emptySendDoesNotFreezeEditingAndRemovingDraftKeepsText() {
        model.send()
        settle()
        assertFalse(model.state.value.retrySend)
        model.text("Agora escrevi")
        assertEquals("Agora escrevi", model.state.value.text)
        val file = file()
        mutable.value = mutable.value.copy(attachment = file)
        model.discardAttachment()
        settle()
        assertFalse(file.file.exists())
        assertEquals("Agora escrevi", model.state.value.text)
    }

    @Test
    fun lateCameraResultIsDeletedWhenAccountOrConversationChanged() {
        for ((user, target) in listOf("different" to thread, actor to "another-thread")) {
            val raw =
                CaptureFiles.create(RuntimeEnvironment.getApplication(), false).apply {
                    writeText("fixture")
                }
            model.receiveSelection(null, user, target, false, raw)
            shadowOf(Looper.getMainLooper()).idle()
            assertFalse(raw.exists())
            assertNull(model.state.value.attachment)
        }
        assertTrue(requests.isEmpty())
    }
}
