package app.menchat.nativeapp

import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class GatewayTest {
    private lateinit var server: MockWebServer
    private lateinit var gateway: Gateway
    private val actor = "10000000-0000-4000-8000-000000000001"

    @Before
    fun prepare() {
        server = MockWebServer()
        server.start()
        gateway =
            Gateway(
                OkHttpClient(),
                PublicConfig(server.url("/").toString().trimEnd('/'), "sb_publishable_fixture"),
                { 1000 },
            )
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

    @Test
    fun loginValidatesRemoteUserAndOwnActiveProfileBeforeSaving() {
        var saved: Credentials? = null
        gateway.onCredentials = { saved = it }
        response(
            """{"access_token":"access-fixture","refresh_token":"refresh-fixture","expires_in":3600}"""
        )
        response("""{"id":"$actor","email_confirmed_at":"2026-01-01"}""")
        response(
            """[{"id":"$actor","display_name":"Pessoa","user_code":"AB123C","status_message":"Oi"}]"""
        )
        assertEquals(actor, gateway.login("pessoa@example.test", "only-in-memory").id)
        assertNotNull(saved)
        val login = server.takeRequest()
        assertEquals("/auth/v1/token?grant_type=password", login.path)
        assertEquals("sb_publishable_fixture", login.getHeader("apikey"))
        val user = server.takeRequest()
        assertEquals("/auth/v1/user", user.path)
        assertEquals("Bearer access-fixture", user.getHeader("Authorization"))
        val profile = server.takeRequest()
        assertEquals("eq.$actor", profile.requestUrl!!.queryParameter("id"))
        assertEquals("eq.active", profile.requestUrl!!.queryParameter("account_status"))
    }

    @Test
    fun pendingOrForeignProfileNeverBecomesSavedSession() {
        var saved = false
        gateway.onCredentials = { saved = true }
        response(
            """{"access_token":"access-fixture","refresh_token":"refresh-fixture","expires_in":3600}"""
        )
        response("""{"id":"$actor","email_confirmed_at":"2026-01-01"}""")
        response("[]")
        assertThrows(IllegalArgumentException::class.java) {
            gateway.login("a@example.test", "password")
        }
        assertFalse(saved)
        assertNull(gateway.credentials)
    }

    @Test
    fun refreshRotationIsSavedBeforeAuthenticatedCall() {
        gateway.credentials = Credentials("expired", "old-refresh", 900)
        var saved: Credentials? = null
        gateway.onCredentials = { saved = it }
        response("""{"access_token":"rotated","refresh_token":"new-refresh","expires_in":3600}""")
        response("[]")
        assertTrue(gateway.conversations().isEmpty())
        assertEquals("new-refresh", saved!!.refresh)
        assertEquals("/auth/v1/token?grant_type=refresh_token", server.takeRequest().path)
        assertEquals("Bearer rotated", server.takeRequest().getHeader("Authorization"))
    }

    @Test
    fun sendKeepsClientIdentifierForSafeRetriesAndUsesActorToken() {
        gateway.credentials = Credentials("actor-token", "refresh", 9000)
        val message =
            """{"id":"message-fixture","seq":42,"sender_id":"$actor","body":"Olá","created_at":"2026-01-01T12:00:00Z","attachment_id":null,"reply_to":null,"deleted_at":null}"""
        repeat(2) { response(message) }
        repeat(2) {
            assertEquals(42L, gateway.send("message-fixture", "thread-fixture", "Olá").seq)
        }
        repeat(2) {
            val request = server.takeRequest()
            val data = JSONObject(request.body.readUtf8())
            assertEquals("message-fixture", data.getString("p_id"))
            assertEquals("thread-fixture", data.getString("p_thread"))
            assertEquals("Bearer actor-token", request.getHeader("Authorization"))
            assertFalse(data.has("sender_id"))
        }
    }

    @Test
    fun voiceRetryKeepsReservationAndNeverOverwritesOrIgnoresDeniedUpload() {
        gateway.credentials = Credentials("actor-token", "refresh", 9000)
        val file = java.io.File.createTempFile("voice-test", ".m4a")
        try {
            file.writeBytes(byteArrayOf(1, 2, 3))
            val item = PreparedVoice("upload-fixture", "$actor/upload-fixture")
            response("""{"statusCode":"409","error":"Duplicate"}""", 400)
            gateway.uploadVoice(item, file)
            val request = server.takeRequest()
            assertEquals("/storage/v1/object/menchat-media/${item.path}", request.path)
            assertEquals("false", request.getHeader("x-upsert"))
            assertEquals("Bearer actor-token", request.getHeader("Authorization"))
            assertEquals("audio/mp4", request.getHeader("Content-Type"))
            response("""{"statusCode":"403","error":"Unauthorized"}""", 403)
            assertThrows(IllegalStateException::class.java) { gateway.uploadVoice(item, file) }
            assertEquals(request.path, server.takeRequest().path)
        } finally {
            file.delete()
        }
    }

    @Test
    fun runtimeConfigurationRejectsAdministrativeKeyAndUntrustedUrlShapes() {
        assertThrows(IllegalArgumentException::class.java) {
            PublicConfig.parse(
                JSONObject()
                    .put("url", "http://example.test")
                    .put("publishableKey", "sb_publishable_ok")
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            PublicConfig.parse(
                JSONObject()
                    .put("url", "https://example.test")
                    .put("publishableKey", "sb_secret_forbidden")
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            PublicConfig.parse(
                JSONObject()
                    .put("url", "https://user:password@example.test")
                    .put("publishableKey", "sb_publishable_ok")
            )
        }
    }
}
