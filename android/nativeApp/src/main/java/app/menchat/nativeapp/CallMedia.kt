package app.menchat.nativeapp

import android.content.Context
import org.json.JSONObject
import org.webrtc.VideoTrack

internal data class CallMediaEvents(
    val publish: suspend (String, String, String, String, JSONObject) -> Unit,
    val changed: () -> Unit,
    val failed: (String) -> Unit,
)

internal interface CallMedia {
    val localVideo: VideoTrack?
    val micOn: Boolean
    val cameraOn: Boolean
    val speakerOn: Boolean

    fun renew(ice: CallIce)

    fun connected(): Set<String>

    fun remoteVideo(id: String): VideoTrack?

    fun reconcile(members: List<CallMember>)

    suspend fun receive(signal: CallSignal)

    fun microphone(value: Boolean)

    fun camera(value: Boolean)

    fun switchCamera()

    fun route(speaker: Boolean)

    fun renderer(context: Context, track: VideoTrack, mirror: Boolean): NativeRtcRenderer

    fun releaseRenderer(value: NativeRtcRenderer)

    fun close()
}

internal fun interface CallMediaFactory {
    fun create(
        actor: String,
        ice: CallIce,
        video: Boolean,
        noiseSuppression: Boolean,
        events: CallMediaEvents,
    ): CallMedia
}

internal interface CallLifeSupport {
    fun start(video: Boolean, end: () -> Unit)

    fun stop()
}

internal interface CallTransport {
    fun configuration(): CallIce

    fun inbox(): List<CallHeader>

    fun start(id: String, thread: String, video: Boolean)

    fun join(id: String)

    fun leave(id: String)

    fun state(id: String, mic: Boolean, video: Boolean): CallSnapshot

    fun signals(id: String, after: Long): List<CallSignal>

    fun signal(
        call: String,
        to: String,
        toDevice: String,
        id: String,
        kind: String,
        payload: JSONObject,
    )

    fun dispatch(id: String)
}
