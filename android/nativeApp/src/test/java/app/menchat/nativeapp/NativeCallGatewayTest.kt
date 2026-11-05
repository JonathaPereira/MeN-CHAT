package app.menchat.nativeapp

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
class NativeCallGatewayTest {
    @Test
    fun iceUsesAuthenticatedMobileEndpointAndSignalsKeepIdDeviceAndPayloadForRetry() {
        val server = MockWebServer().apply { start() }
        try {
            val gateway =
                Gateway(
                    OkHttpClient(),
                    PublicConfig(server.url("/").toString().trimEnd('/'), "sb_publishable_fixture"),
                    { 1000 },
                    server.url("/").toString().trimEnd('/'),
                )
            gateway.credentials = Credentials("actor-token", "refresh", 9000)
            val calls = CallGateway(gateway, "device-fixture")
            server.enqueue(
                MockResponse()
                    .setBody(
                        """{"iceServers":[{"urls":["turn:turn.example.test:3478"],"username":"temporary","credential":"fixture"}],"expires":9000,"maxParticipants":4}"""
                    )
            )
            assertEquals(1, calls.configuration().servers.size)
            val config = server.takeRequest()
            assertEquals("/api/mobile/calls/config", config.path)
            assertEquals("Bearer actor-token", config.getHeader("Authorization"))
            val payload =
                JSONObject().put("negotiation", "negotiation-fixture").put("sdp", "v=0\r\n")
            repeat(2) {
                server.enqueue(MockResponse().setBody("true"))
                calls.signal("call", "peer", "peer-device", "signal", "offer", payload)
            }
            repeat(2) {
                val request = server.takeRequest()
                val data = JSONObject(request.body.readUtf8())
                assertEquals("/rest/v1/rpc/menchat_call_signal", request.path)
                assertEquals("signal", data.getString("p_id"))
                assertEquals("device-fixture", data.getString("p_device"))
                assertEquals("peer-device", data.getString("p_to_device"))
                assertEquals(payload.toString(), data.getJSONObject("p_payload").toString())
                assertFalse(data.has("sender_id"))
            }
        } finally {
            server.shutdown()
        }
    }
}
