package app.menchat.nativeapp

import java.io.File
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MediaGatewayTest {
    private lateinit var server: MockWebServer
    private lateinit var gateway: Gateway

    @Before
    fun setup() {
        server = MockWebServer().apply { start() }
        gateway =
            Gateway(
                OkHttpClient(),
                PublicConfig(server.url("/").toString().trimEnd('/'), "sb_publishable_fixture"),
                { 1000 },
            )
        gateway.credentials = Credentials("actor-token", "refresh", 9000)
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
    fun reservationAndStreamedUploadUsePrivateBucketAndNeverOverwrite() {
        val file =
            File.createTempFile("media-test", ".pdf").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        try {
            val local = LocalAttachment(file, "anexo.pdf", "application/pdf", "document")
            response("""[{"id":"upload","path":"actor/upload","kind":"document"}]""")
            val upload = gateway.reserveFile("thread", local)
            val reservation = server.takeRequest()
            val data = JSONObject(reservation.body.readUtf8())
            assertEquals("thread", data.getString("p_thread"))
            assertEquals(3L, data.getLong("p_bytes"))
            response("{}")
            gateway.uploadFile(upload, local)
            val request = server.takeRequest()
            assertEquals("/storage/v1/object/menchat-media/actor/upload", request.path)
            assertEquals("false", request.getHeader("x-upsert"))
            assertEquals("application/pdf", request.getHeader("Content-Type"))
            assertEquals("Bearer actor-token", request.getHeader("Authorization"))
            assertEquals(3L, request.body.size)
        } finally {
            file.delete()
        }
    }

    @Test
    fun profileSavesAllPrivacyFlagsAndAvatarUsesSeparateBucket() {
        val file =
            File.createTempFile("avatar-test", ".webp").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        try {
            response("""[{"id":"avatar","path":"actor/avatar","kind":"avatar"}]""")
            val upload =
                gateway.reserveFile(
                    null,
                    LocalAttachment(file, "perfil.webp", "image/webp", "avatar"),
                )
            assertEquals("menchat-avatars", upload.bucket)
            assertTrue(JSONObject(server.takeRequest().body.readUtf8()).isNull("p_thread"))
            response("null")
            gateway.saveProfile(
                ProfileDraft(" Nome ", "Status", false, false, false, false),
                upload.id,
            )
            val data = JSONObject(server.takeRequest().body.readUtf8())
            assertEquals("Nome", data.getString("p_name"))
            assertEquals("avatar", data.getString("p_avatar"))
            for (key in listOf("p_show_code", "p_lookup", "p_read", "p_typing")) assertFalse(
                data.getBoolean(key)
            )
        } finally {
            file.delete()
        }
    }

    @Test
    fun removalUsesStorageDeleteWithBodyBeforeCancellingReservation() {
        response("[]")
        response("true")
        gateway.discardFile(PreparedVoice("upload", "actor/upload"))
        val deletion = server.takeRequest()
        assertEquals("DELETE", deletion.method)
        assertEquals(
            "actor/upload",
            JSONObject(deletion.body.readUtf8()).getJSONArray("prefixes").getString(0),
        )
        assertEquals("Bearer actor-token", deletion.getHeader("Authorization"))
        assertEquals("/rest/v1/rpc/menchat_cancel_upload", server.takeRequest().path)
    }

    @Test
    fun signedUrlStaysOnConfiguredStorageAndRejectsForeignHosts() {
        response("""{"signedURL":"/object/sign/menchat-avatars/actor/avatar?token=fixture"}""")
        assertEquals(
            server
                .url("/storage/v1/object/sign/menchat-avatars/actor/avatar?token=fixture")
                .toString(),
            gateway.avatarUrl("actor/avatar"),
        )
        server.takeRequest()
        response("""{"signedURL":"https://foreign.example.test/file"}""")
        assertThrows(IllegalArgumentException::class.java) { gateway.avatarUrl("actor/avatar") }
    }

    @Test
    fun fullStorageMessageIsActionableWithoutExposingRemoteBody() {
        response(
            """{"code":"23514","message":"Armazenamento do aplicativo cheio (500 MB). private-details"}""",
            400,
        )
        val file = File.createTempFile("media-test", ".pdf").apply { writeText("abc") }
        try {
            val error =
                assertThrows(NativeApiException::class.java) {
                    gateway.reserveFile(
                        "thread",
                        LocalAttachment(file, "teste.pdf", "application/pdf", "document"),
                    )
                }
            assertTrue(error.message!!.contains("cheio"))
            assertFalse(error.message!!.contains("private-details"))
        } finally {
            file.delete()
        }
    }
}
