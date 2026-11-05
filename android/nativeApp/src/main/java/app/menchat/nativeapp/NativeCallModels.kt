package app.menchat.nativeapp

import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.PeerConnection

internal data class CallMember(
    val id: String,
    val name: String,
    val avatar: String?,
    val state: String,
    val device: String?,
    val mic: Boolean,
    val video: Boolean,
)

internal data class CallHeader(
    val id: String,
    val thread: String,
    val caller: String,
    val video: Boolean,
    val state: String,
    val mine: String?,
    val created: String,
)

internal data class CallSnapshot(val header: CallHeader, val members: List<CallMember>)

internal data class CallSignal(
    val seq: Long,
    val sender: String,
    val device: String,
    val kind: String,
    val payload: JSONObject,
)

internal data class CallIce(val servers: List<PeerConnection.IceServer>, val expires: Long)

internal fun JSONObject.callHeader() =
    CallHeader(
        getString("id"),
        getString("thread"),
        getString("caller"),
        getBoolean("video"),
        getString("state"),
        optional("mine"),
        getString("created"),
    )

internal class CallGateway(private val gateway: Gateway, val device: String) : CallTransport {
    override fun configuration(): CallIce {
        val data = gateway.mobile("/api/mobile/calls/config")
        require(data.getInt("maxParticipants") == 4)
        val servers =
            data.getJSONArray("iceServers").objects().map { item ->
                val urls =
                    item.getJSONArray("urls").let { a ->
                        (0 until a.length()).map { a.getString(it) }
                    }
                require(
                    urls.isNotEmpty() &&
                        urls.size <= 8 &&
                        urls.all {
                            Regex(
                                    "(?:stun|turn|turns):[A-Za-z0-9.:-]+(?:\\?transport=(?:udp|tcp))?"
                                )
                                .matches(it)
                        }
                )
                PeerConnection.IceServer.builder(urls)
                    .setUsername(item.optString("username"))
                    .setPassword(item.optString("credential"))
                    .createIceServer()
            }
        require(servers.size in 1..8)
        return CallIce(servers, data.getLong("expires"))
    }

    override fun inbox() =
        JSONArray(gateway.rpc("menchat_call_inbox", JSONObject().put("p_device", device)))
            .objects()
            .map { it.callHeader() }

    override fun start(id: String, thread: String, video: Boolean) {
        require(
            gateway
                .rpc(
                    "menchat_start_call",
                    JSONObject()
                        .put("p_id", id)
                        .put("p_thread", thread)
                        .put("p_device", device)
                        .put("p_video", video),
                )
                .trim('"') == id
        )
    }

    override fun join(id: String) {
        require(
            gateway.rpc(
                "menchat_join_call",
                JSONObject().put("p_call", id).put("p_device", device),
            ) == "true"
        )
    }

    override fun leave(id: String) {
        gateway.rpc("menchat_leave_call", JSONObject().put("p_call", id).put("p_device", device))
    }

    override fun state(id: String, mic: Boolean, video: Boolean): CallSnapshot {
        val data =
            JSONObject(
                gateway.rpc(
                    "menchat_call_state",
                    JSONObject()
                        .put("p_call", id)
                        .put("p_device", device)
                        .put("p_mic", mic)
                        .put("p_video", video),
                )
            )
        return CallSnapshot(
            data.callHeader(),
            data.getJSONArray("members").objects().map {
                CallMember(
                    it.getString("id"),
                    it.getString("name"),
                    it.optional("avatar"),
                    it.getString("state"),
                    it.optional("device"),
                    it.getBoolean("mic"),
                    it.getBoolean("video"),
                )
            },
        )
    }

    override fun signals(id: String, after: Long) =
        JSONArray(
                gateway.rpc(
                    "menchat_call_signals",
                    JSONObject().put("p_call", id).put("p_device", device).put("p_after", after),
                )
            )
            .objects()
            .map {
                CallSignal(
                    it.getLong("seq"),
                    it.getString("sender_id"),
                    it.getString("sender_device"),
                    it.getString("kind"),
                    it.getJSONObject("payload"),
                )
            }

    override fun signal(
        call: String,
        to: String,
        toDevice: String,
        id: String,
        kind: String,
        payload: JSONObject,
    ) {
        gateway.rpc(
            "menchat_call_signal",
            JSONObject()
                .put("p_call", call)
                .put("p_device", device)
                .put("p_to", to)
                .put("p_to_device", toDevice)
                .put("p_id", id)
                .put("p_kind", kind)
                .put("p_payload", payload),
        )
    }

    override fun dispatch(id: String) {
        gateway.mobile("/api/mobile/calls/dispatch", JSONObject().put("id", id))
    }
}
