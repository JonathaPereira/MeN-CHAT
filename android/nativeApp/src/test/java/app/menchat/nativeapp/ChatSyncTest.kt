package app.menchat.nativeapp

import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.util.ReflectionHelpers

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35, 36])
class ChatSyncTest {
    private lateinit var server: MockWebServer
    private lateinit var model: MainModel
    private lateinit var mutable: MutableStateFlow<NativeState>
    private val actor = "10000000-0000-4000-8000-000000000001"
    private val thread = "20000000-0000-4000-8000-000000000002"
    private val message = "30000000-0000-4000-8000-000000000003"
    private val inbox
        get() =
            """[{"id":"$thread","name":"Contato","can_send":true,"kind":"private","unread_count":1}]"""

    private val history
        get() =
            """[{"id":"$message","seq":42,"sender_id":"$actor","body":"Texto privado de teste","created_at":"2026-01-01T12:00:00Z","attachment_id":null,"reply_to":null,"deleted_at":null}]"""

    @Before
    fun prepare() {
        server = MockWebServer().apply { start() }
        val gateway =
            Gateway(
                OkHttpClient(),
                PublicConfig(server.url("/").toString().trimEnd('/'), "sb_publishable_fixture"),
                { 1000 },
            )
        gateway.credentials = Credentials("actor-token", "refresh", 9000)
        model = MainModel(RuntimeEnvironment.getApplication(), gateway)
        mutable = ReflectionHelpers.getField(model, "mutable")
        mutable.value =
            NativeState(
                account = Account(actor, "Pessoa", "AB123C", ""),
                selected = Conversation(thread, "Contato", false, true, "", 1),
            )
        model.foreground = true
    }

    @After
    fun close() {
        server.shutdown()
    }

    private fun response(body: String, code: Int = 200) {
        server.enqueue(
            MockResponse()
                .setResponseCode(code)
                .setBody(body)
                .addHeader("Content-Type", "application/json")
        )
    }

    private fun core() {
        response(inbox)
        response(history)
        response("""[{"id":"$message","deleted_at":null}]""")
    }

    private fun receipts() {
        response("null")
        response("null")
    }

    @Test
    fun rosterFailureDoesNotHideMessagesOrPreventReadReceipt() = runBlocking {
        core()
        response("""{"code":"P0001","message":"private server detail"}""", 500)
        receipts()
        model.refresh()
        assertEquals(listOf("Texto privado de teste"), model.state.value.messages.map { it.text })
        val notice = model.state.value.notice!!
        assertTrue(notice.contains("participantes"))
        assertTrue(notice.contains("HTTP 500"))
        assertFalse(notice.contains("private server detail"))
        val requests = List(6) { server.takeRequest(1, TimeUnit.SECONDS)!! }
        assertEquals("/rest/v1/rpc/menchat_seen", requests[4].path)
        assertEquals("/rest/v1/rpc/menchat_touch", requests[5].path)
        assertTrue(requests.all { it.getHeader("Authorization") == "Bearer actor-token" })
    }

    @Test
    fun receiptFailureKeepsMessagesAndIdentifiesReadConfirmation() = runBlocking {
        core()
        response("[]")
        response("""{"code":"42501","message":"private server detail"}""", 403)
        model.refresh()
        assertEquals(1, model.state.value.messages.size)
        assertTrue(model.state.value.notice!!.contains("leitura"))
        assertTrue(model.state.value.notice!!.contains("HTTP 403"))
    }

    @Test
    fun historyDeniedClearsPreviouslyLoadedMessagesAndExplainsPermission() = runBlocking {
        mutable.value =
            mutable.value.copy(
                messages = listOf(Message(message, 41, actor, "Anterior", "", null, false, null))
            )
        response(inbox)
        response("""{"code":"42501","message":"private-body actor-token"}""", 403)
        model.refresh()
        assertTrue(model.state.value.messages.isEmpty())
        val notice = model.state.value.notice!!
        assertTrue(notice.contains("permissão"))
        assertTrue(notice.contains("HISTORICO"))
        assertFalse(notice.contains("private-body"))
        assertFalse(notice.contains("actor-token"))
    }

    @Test
    fun incompatibleHistoryIsDistinguishedFromNetworkFailure() = runBlocking {
        response(inbox)
        response("""[{"id":"$message","body":"private-body"}]""")
        model.refresh()
        val notice = model.state.value.notice!!
        assertTrue(notice.contains("formato"))
        assertTrue(notice.contains("HISTORICO"))
        assertFalse(notice.contains("private-body"))
        assertTrue(model.state.value.messages.isEmpty())
    }

    @Test
    fun inboxFailureDoesNotBlockAlreadySelectedConversation() = runBlocking {
        response("{}", 503)
        response(history)
        response("""[{"id":"$message","deleted_at":null}]""")
        response("[]")
        receipts()
        model.refresh()
        assertEquals(1, model.state.value.messages.size)
        assertTrue(model.state.value.notice!!.contains("LISTA"))
    }

    @Test
    fun pickerAndMediaViewerPreventReadAcknowledgementsBehindTheOverlay() = runBlocking {
        for (picker in listOf(true, false)) {
            model.pickerCovered = picker
            model.mediaCovered = !picker
            core()
            response("[]")
            model.refresh()
            val requests = List(4) { server.takeRequest(1, TimeUnit.SECONDS)!! }
            assertFalse(
                requests.any {
                    it.path == "/rest/v1/rpc/menchat_seen" ||
                        it.path == "/rest/v1/rpc/menchat_touch"
                }
            )
        }
    }

    @Test
    fun lateFailureDoesNotShowErrorInAnotherConversation() {
        server.enqueue(
            MockResponse()
                .setResponseCode(500)
                .setBody("{}")
                .setBodyDelay(200, TimeUnit.MILLISECONDS)
        )
        val executor = Executors.newSingleThreadExecutor()
        try {
            val job = executor.submit { runBlocking { model.refresh() } }
            assertNotNull(server.takeRequest(2, TimeUnit.SECONDS))
            model.select(null)
            job.get(5, TimeUnit.SECONDS)
            assertNull(model.state.value.selected)
            assertNull(model.state.value.notice)
        } finally {
            executor.shutdownNow()
        }
    }

    @Test
    fun selectingConversationDuringActivePollQueuesImmediateRefresh() = runBlocking {
        val nextThread = "20000000-0000-4000-8000-000000000099"
        val nextMessage = "30000000-0000-4000-8000-000000000099"
        val bothInbox =
            """[{"id":"$thread","name":"Contato","can_send":true,"kind":"private","unread_count":0},{"id":"$nextThread","name":"Outro","can_send":true,"kind":"private","unread_count":1}]"""
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody(bothInbox)
                .addHeader("Content-Type", "application/json")
                .setBodyDelay(150, TimeUnit.MILLISECONDS)
        )
        response(bothInbox)
        response(
            """[{"id":"$nextMessage","seq":7,"sender_id":"$actor","body":"Mensagem da nova conversa","created_at":"2026-01-01T12:05:00Z","attachment_id":null,"reply_to":null,"deleted_at":null}]"""
        )
        response("""[{"id":"$nextMessage","deleted_at":null}]""")
        response("[]")
        receipts()

        val executor = Executors.newSingleThreadExecutor()
        try {
            val job = executor.submit { runBlocking { model.refresh() } }
            assertNotNull(server.takeRequest(2, TimeUnit.SECONDS))
            model.select(Conversation(nextThread, "Outro", false, true, "", 1))
            job.get(5, TimeUnit.SECONDS)
            assertEquals(nextThread, model.state.value.selected?.id)
            assertEquals(
                listOf("Mensagem da nova conversa"),
                model.state.value.messages.map { it.text },
            )
        } finally {
            executor.shutdownNow()
        }
    }
}
