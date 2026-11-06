package app.menchat.nativeapp

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaRecorder
import android.os.Build
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import org.json.JSONObject
import org.webrtc.*
import org.webrtc.audio.JavaAudioDeviceModule

internal fun audioConstraints(noiseSuppression: Boolean) =
    MediaConstraints().apply {
        mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "true"))
        mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "true"))
        mandatory.add(MediaConstraints.KeyValuePair("googHighpassFilter", "true"))
        mandatory.add(
            MediaConstraints.KeyValuePair(
                "googNoiseSuppression",
                if (noiseSuppression) "true" else "false",
            )
        )
        optional.add(MediaConstraints.KeyValuePair("googEchoCancellation2", "true"))
        optional.add(MediaConstraints.KeyValuePair("googDAEchoCancellation", "true"))
        optional.add(MediaConstraints.KeyValuePair("googAudioMirroring", "false"))
    }

internal fun hasExternalAudioDevice(audioManager: AudioManager): Boolean {
    val externalTypes =
        setOf(
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BLE_HEADSET,
            AudioDeviceInfo.TYPE_BLE_SPEAKER,
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_USB_HEADSET,
            AudioDeviceInfo.TYPE_USB_DEVICE,
        )
    return runCatching {
            audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any {
                it.type in externalTypes
            }
        }
        .getOrDefault(false)
}

/** Tracks and renderer ownership stay here; no SDP, ICE or media enters logs/storage. */
internal class NativeRtc(
    private val context: Context,
    private val actor: String,
    ice: CallIce,
    private val videoCall: Boolean,
    noiseSuppression: Boolean,
    private val publish: suspend (String, String, String, String, JSONObject) -> Unit,
    private val changed: () -> Unit,
    private val failed: (String) -> Unit,
) : CallMedia {
    companion object {
        private var initialized = false

        @Synchronized
        private fun initialize(context: Context) {
            if (initialized) return
            PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(context)
                    .setEnableInternalTracer(false)
                    .createInitializationOptions()
            )
            Logging.enableLogToDebugOutput(Logging.Severity.LS_NONE)
            initialized = true
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val audioManager = context.getSystemService(AudioManager::class.java)
    private val previousMode = audioManager.mode
    private val peers = mutableMapOf<String, Peer>()
    private val renderers = mutableSetOf<NativeRtcRenderer>()
    private val outgoing = Channel<Packet>(256)
    private var configuration = ice
    private var closed = false
    private lateinit var egl: EglBase
    private lateinit var factory: PeerConnectionFactory
    private lateinit var adm: JavaAudioDeviceModule
    private lateinit var audioSource: AudioSource
    private lateinit var audioTrack: AudioTrack
    private var videoSource: VideoSource? = null
    override var localVideo: VideoTrack? = null
        private set

    private var capture: CameraVideoCapturer? = null
    private var texture: SurfaceTextureHelper? = null
    override var micOn = true
        private set

    override var cameraOn = false
        private set

    override var speakerOn = videoCall && !hasExternalAudioDevice(audioManager)
        private set

    private val audioAttributes =
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
    private val focus =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(audioAttributes)
            .setOnAudioFocusChangeListener { value ->
                if (
                    value == AudioManager.AUDIOFOCUS_LOSS ||
                        value == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
                )
                    scope.launch {
                        microphone(false)
                        failed(
                            "O áudio foi interrompido pelo sistema. Ative o microfone quando puder continuar."
                        )
                    }
            }
            .build()

    private data class Packet(
        val id: String,
        val to: String,
        val device: String,
        val kind: String,
        val payload: JSONObject,
    )

    private class Peer(val device: String) {
        lateinit var pc: PeerConnection
        var video: VideoTrack? = null
        var negotiation = ""
        var remoteNegotiation = ""
        var offering = false
        var restarts = 0
        var connected = false
        val pending = mutableMapOf<String, MutableList<IceCandidate>>()
        var reconnect: Job? = null
    }

    init {
        try {
            initialize(context)
            require(
                audioManager.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            ) {
                "O áudio está ocupado por outro aplicativo."
            }
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            applyAudioRoute(speakerOn)
            egl = EglBase.create()
            adm =
                JavaAudioDeviceModule.builder(context)
                    .setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
                    .setAudioAttributes(audioAttributes)
                    .setUseHardwareAcousticEchoCanceler(
                        JavaAudioDeviceModule.isBuiltInAcousticEchoCancelerSupported()
                    )
                    .setUseHardwareNoiseSuppressor(
                        noiseSuppression &&
                            JavaAudioDeviceModule.isBuiltInNoiseSuppressorSupported()
                    )
                    .createAudioDeviceModule()
            factory =
                PeerConnectionFactory.builder()
                    .setAudioDeviceModule(adm)
                    .setVideoEncoderFactory(
                        DefaultVideoEncoderFactory(egl.eglBaseContext, true, true)
                    )
                    .setVideoDecoderFactory(DefaultVideoDecoderFactory(egl.eglBaseContext))
                    .createPeerConnectionFactory()
            audioSource = factory.createAudioSource(audioConstraints(noiseSuppression))
            audioTrack = factory.createAudioTrack("menchat-audio", audioSource)
            if (videoCall) {
                videoSource = factory.createVideoSource(false)
                localVideo = factory.createVideoTrack("menchat-video", videoSource)
                camera(true)
            }
            scope.launch {
                for (packet in outgoing) {
                    for (attempt in 0..2) {
                        try {
                            withContext(Dispatchers.IO) {
                                publish(
                                    packet.to,
                                    packet.device,
                                    packet.id,
                                    packet.kind,
                                    packet.payload,
                                )
                            }
                            break
                        } catch (cancel: CancellationException) {
                            throw cancel
                        } catch (_: Exception) {
                            if (attempt == 2) failed("Sinalização instável. Tentando reconectar…")
                            else delay(300L * (attempt + 1))
                        }
                    }
                }
            }
        } catch (error: Exception) {
            close()
            throw IllegalStateException(
                "Não foi possível iniciar os dispositivos da chamada. Confira as permissões e tente novamente."
            )
        }
    }

    private fun rtcConfig() =
        PeerConnection.RTCConfiguration(configuration.servers).apply {
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

    override fun renew(ice: CallIce) {
        configuration = ice
        peers.forEach { (id, peer) ->
            peer.pc.setConfiguration(rtcConfig())
            restart(id)
        }
    }

    override fun connected() = peers.filterValues { it.connected }.keys.toSet()

    override fun remoteVideo(id: String) = peers[id]?.video

    override fun reconcile(members: List<CallMember>) {
        if (closed) return
        val joined = members.filter { it.id != actor && it.state == "joined" && it.device != null }
        peers.keys
            .toList()
            .filter { id -> joined.none { it.id == id && it.device == peers[id]?.device } }
            .forEach { closePeer(it) }
        joined.forEach { member ->
            if (member.id !in peers) {
                createPeer(member)
                if (actor < member.id) scope.launch { offer(member.id) }
            }
        }
    }

    private fun createPeer(member: CallMember) {
        val peer = Peer(member.device!!)
        peers[member.id] = peer
        peer.pc =
            factory.createPeerConnection(
                rtcConfig(),
                object : PeerConnection.Observer {
                    override fun onSignalingChange(state: PeerConnection.SignalingState) {}

                    override fun onIceConnectionReceivingChange(value: Boolean) {}

                    override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}

                    override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) {}

                    override fun onAddStream(stream: MediaStream) {}

                    override fun onRemoveStream(stream: MediaStream) {}

                    override fun onDataChannel(channel: DataChannel) {}

                    override fun onRenegotiationNeeded() {}

                    override fun onIceCandidate(candidate: IceCandidate) {
                        scope.launch {
                            if (peers[member.id] === peer && peer.negotiation.isNotBlank())
                                enqueue(
                                    member.id,
                                    "ice",
                                    JSONObject()
                                        .put("negotiation", peer.negotiation)
                                        .put("candidate", candidate.sdp)
                                        .put("sdpMid", candidate.sdpMid ?: JSONObject.NULL)
                                        .put("sdpMLineIndex", candidate.sdpMLineIndex),
                                )
                        }
                    }

                    override fun onTrack(transceiver: RtpTransceiver) {
                        val track = transceiver.receiver.track()
                        if (track is VideoTrack)
                            scope.launch {
                                if (peers[member.id] === peer) {
                                    peer.video = track
                                    changed()
                                }
                            }
                    }

                    override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
                        scope.launch {
                            if (peers[member.id] !== peer) return@launch
                            peer.reconnect?.cancel()
                            peer.connected =
                                state in
                                    listOf(
                                        PeerConnection.IceConnectionState.CONNECTED,
                                        PeerConnection.IceConnectionState.COMPLETED,
                                    )
                            if (peer.connected) peer.restarts = 0
                            if (
                                state in
                                    listOf(
                                        PeerConnection.IceConnectionState.DISCONNECTED,
                                        PeerConnection.IceConnectionState.FAILED,
                                    )
                            )
                                peer.reconnect = scope.launch {
                                    delay(4000)
                                    restart(member.id)
                                }
                            changed()
                        }
                    }
                },
            ) ?: error("Conexão indisponível")
        peer.pc.addTrack(audioTrack, listOf("menchat"))
        localVideo?.let { peer.pc.addTrack(it, listOf("menchat")) }
        peer.pc.setBitrate(
            if (videoCall) 100_000 else 24_000,
            if (videoCall) 350_000 else 48_000,
            if (videoCall) 700_000 else 96_000,
        )
        peer.reconnect = scope.launch {
            delay(6000)
            if (peers[member.id] === peer && !peer.connected) restart(member.id)
        }
    }

    private fun enqueue(to: String, kind: String, payload: JSONObject) {
        val peer = peers[to] ?: return
        if (closed) return
        if (
            outgoing
                .trySend(Packet(UUID.randomUUID().toString(), to, peer.device, kind, payload))
                .isFailure
        )
            failed("A conexão está congestionada. Tente reconectar a chamada.")
    }

    private fun restart(id: String) {
        val peer = peers[id] ?: return
        if (closed || peer.restarts >= 3) return
        peer.restarts++
        if (actor < id) scope.launch { offer(id, true) } else enqueue(id, "restart", JSONObject())
        failed("Tentando reconectar a chamada…")
    }

    private suspend fun createSdp(
        peer: Peer,
        offer: Boolean,
        restart: Boolean = false,
    ): SessionDescription =
        withTimeout(10000) {
            suspendCancellableCoroutine { continuation ->
                val observer =
                    object : SdpObserver {
                        override fun onCreateSuccess(value: SessionDescription) {
                            if (continuation.isActive) continuation.resume(value)
                        }

                        override fun onSetSuccess() {}

                        override fun onCreateFailure(message: String) {
                            if (continuation.isActive)
                                continuation.resumeWithException(
                                    IllegalStateException("Falha na negociação")
                                )
                        }

                        override fun onSetFailure(message: String) {}
                    }
                val constraints =
                    MediaConstraints().apply {
                        if (restart)
                            mandatory.add(MediaConstraints.KeyValuePair("IceRestart", "true"))
                    }
                if (offer) peer.pc.createOffer(observer, constraints)
                else peer.pc.createAnswer(observer, constraints)
            }
        }

    private suspend fun description(peer: Peer, value: SessionDescription, local: Boolean) =
        withTimeout(10000) {
            suspendCancellableCoroutine<Unit> { continuation ->
                val observer =
                    object : SdpObserver {
                        override fun onCreateSuccess(value: SessionDescription) {}

                        override fun onSetSuccess() {
                            if (continuation.isActive) continuation.resume(Unit)
                        }

                        override fun onCreateFailure(message: String) {}

                        override fun onSetFailure(message: String) {
                            if (continuation.isActive)
                                continuation.resumeWithException(
                                    IllegalStateException("Falha na negociação")
                                )
                        }
                    }
                if (local) peer.pc.setLocalDescription(observer, value)
                else peer.pc.setRemoteDescription(observer, value)
            }
        }

    private suspend fun offer(id: String, restart: Boolean = false) {
        val peer = peers[id] ?: return
        if (closed || peer.offering) return
        peer.offering = true
        peer.negotiation = UUID.randomUUID().toString()
        try {
            val value = createSdp(peer, true, restart)
            description(peer, value, true)
            if (peers[id] === peer)
                enqueue(
                    id,
                    "offer",
                    JSONObject().put("negotiation", peer.negotiation).put("sdp", value.description),
                )
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            failed("Não foi possível negociar a chamada. Tente reconectar.")
        } finally {
            peer.offering = false
        }
    }

    override suspend fun receive(signal: CallSignal) {
        val peer = peers[signal.sender] ?: return
        if (closed || peer.device != signal.device) return
        val payload = signal.payload
        val negotiation = payload.optString("negotiation")
        try {
            if (signal.kind == "restart") {
                if (actor < signal.sender) offer(signal.sender, true)
                return
            }
            if (signal.kind == "ice") {
                val candidate =
                    IceCandidate(
                        payload.optional("sdpMid"),
                        payload.getInt("sdpMLineIndex"),
                        payload.getString("candidate"),
                    )
                if (peer.remoteNegotiation == negotiation && peer.pc.remoteDescription != null)
                    runCatching { peer.pc.addIceCandidate(candidate) }
                else if (peer.pending.size < 5) {
                    val items = peer.pending.getOrPut(negotiation) { mutableListOf() }
                    if (items.size < 80) items += candidate
                }
                return
            }
            if (signal.kind == "offer" && signal.sender < actor) {
                peer.negotiation = negotiation
                if (peer.pc.signalingState() == PeerConnection.SignalingState.HAVE_LOCAL_OFFER) {
                    runCatching {
                        description(
                            peer,
                            SessionDescription(SessionDescription.Type.ROLLBACK, ""),
                            true,
                        )
                    }
                }
                description(
                    peer,
                    SessionDescription(SessionDescription.Type.OFFER, payload.getString("sdp")),
                    false,
                )
                peer.remoteNegotiation = negotiation
                val answer = createSdp(peer, false)
                description(peer, answer, true)
                enqueue(
                    signal.sender,
                    "answer",
                    JSONObject().put("negotiation", negotiation).put("sdp", answer.description),
                )
            } else if (
                signal.kind == "answer" &&
                    negotiation == peer.negotiation &&
                    peer.pc.signalingState() == PeerConnection.SignalingState.HAVE_LOCAL_OFFER
            ) {
                description(
                    peer,
                    SessionDescription(SessionDescription.Type.ANSWER, payload.getString("sdp")),
                    false,
                )
                peer.remoteNegotiation = negotiation
            }
            peer.pending.remove(peer.remoteNegotiation)?.forEach {
                runCatching { peer.pc.addIceCandidate(it) }
            }
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            failed("Não foi possível negociar a chamada. Tente reconectar.")
        }
    }

    override fun microphone(value: Boolean) {
        if (closed || !::audioTrack.isInitialized) return
        if (
            value &&
                audioManager.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        ) {
            failed("O áudio está ocupado por outro aplicativo.")
            return
        }
        micOn = value
        audioTrack.setEnabled(value)
        changed()
    }

    override fun camera(value: Boolean) {
        if (closed || !videoCall || localVideo == null) return
        if (value == cameraOn) return
        if (value) {
            if (capture == null) {
                val enumerator: CameraEnumerator =
                    if (Camera2Enumerator.isSupported(context)) Camera2Enumerator(context)
                    else Camera1Enumerator(true)
                val name =
                    enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) }
                        ?: enumerator.deviceNames.firstOrNull()
                        ?: error("Câmera indisponível")
                capture =
                    enumerator.createCapturer(
                        name,
                        object : CameraVideoCapturer.CameraEventsHandler {
                            override fun onCameraError(message: String) {
                                scope.launch {
                                    localVideo?.setEnabled(false)
                                    cameraOn = false
                                    changed()
                                    failed("A câmera foi interrompida. Confira as permissões.")
                                }
                            }

                            override fun onCameraDisconnected() {
                                onCameraError("")
                            }

                            override fun onCameraFreezed(message: String) {
                                onCameraError("")
                            }

                            override fun onCameraOpening(name: String) {}

                            override fun onFirstFrameAvailable() {}

                            override fun onCameraClosed() {}
                        },
                    ) ?: error("Câmera indisponível")
                texture = SurfaceTextureHelper.create("MenChatCamera", egl.eglBaseContext)
                capture!!.initialize(texture, context, videoSource!!.capturerObserver)
            }
            capture!!.startCapture(640, 480, 24)
            localVideo?.setEnabled(true)
            cameraOn = true
        } else {
            localVideo?.setEnabled(false)
            runCatching { capture?.stopCapture() }
            cameraOn = false
        }
        changed()
    }

    override fun switchCamera() {
        if (cameraOn)
            capture?.switchCamera(
                object : CameraVideoCapturer.CameraSwitchHandler {
                    override fun onCameraSwitchDone(front: Boolean) {
                        changed()
                    }

                    override fun onCameraSwitchError(message: String) {
                        failed("Não foi possível alternar a câmera.")
                    }
                }
            )
    }

    @Suppress("DEPRECATION")
    private fun applyAudioRoute(speaker: Boolean) {
        if (Build.VERSION.SDK_INT >= 31) {
            val kinds =
                if (speaker) listOf(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER)
                else
                    listOf(
                        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                        AudioDeviceInfo.TYPE_BLE_HEADSET,
                        AudioDeviceInfo.TYPE_BLE_SPEAKER,
                        AudioDeviceInfo.TYPE_WIRED_HEADSET,
                        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                        AudioDeviceInfo.TYPE_USB_HEADSET,
                        AudioDeviceInfo.TYPE_USB_DEVICE,
                        AudioDeviceInfo.TYPE_BUILTIN_EARPIECE,
                    )
            val device = kinds.firstNotNullOfOrNull { kind ->
                audioManager.availableCommunicationDevices.firstOrNull { it.type == kind }
            }
            if (device != null) audioManager.setCommunicationDevice(device)
            else audioManager.clearCommunicationDevice()
        } else audioManager.isSpeakerphoneOn = speaker
        speakerOn = speaker
    }

    override fun route(speaker: Boolean) {
        applyAudioRoute(speaker)
        changed()
    }

    override fun renderer(context: Context, track: VideoTrack, mirror: Boolean): NativeRtcRenderer {
        check(!closed)
        return NativeRtcRenderer(context, track, egl.eglBaseContext, mirror).also {
            renderers += it
        }
    }

    override fun releaseRenderer(value: NativeRtcRenderer) {
        value.close()
        renderers -= value
    }

    private fun closePeer(id: String) {
        val peer = peers.remove(id) ?: return
        peer.reconnect?.cancel()
        renderers.filter { it.track === peer.video }.toList().forEach { releaseRenderer(it) }
        peer.pc.close()
        peer.pc.dispose()
        changed()
    }

    @Suppress("DEPRECATION")
    override fun close() {
        if (closed) return
        closed = true
        scope.cancel()
        outgoing.close()
        renderers.toList().forEach { releaseRenderer(it) }
        peers.keys.toList().forEach { closePeer(it) }
        runCatching { capture?.stopCapture() }
        runCatching { capture?.dispose() }
        capture = null
        texture?.dispose()
        texture = null
        localVideo?.dispose()
        localVideo = null
        videoSource?.dispose()
        videoSource = null
        if (::audioTrack.isInitialized) audioTrack.dispose()
        if (::audioSource.isInitialized) audioSource.dispose()
        if (::factory.isInitialized) factory.dispose()
        if (::adm.isInitialized) adm.release()
        if (::egl.isInitialized) egl.release()
        audioManager.abandonAudioFocusRequest(focus)
        if (Build.VERSION.SDK_INT >= 31) audioManager.clearCommunicationDevice()
        else audioManager.isSpeakerphoneOn = false
        if (audioManager.mode == AudioManager.MODE_IN_COMMUNICATION)
            audioManager.mode = previousMode
    }
}

internal class NativeRtcRenderer(
    context: Context,
    val track: VideoTrack,
    egl: EglBase.Context,
    mirror: Boolean,
) {
    val view = SurfaceViewRenderer(context)
    private var closed = false

    init {
        view.init(egl, null)
        view.setMirror(mirror)
        view.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
        view.setEnableHardwareScaler(true)
        track.addSink(view)
    }

    fun close() {
        if (closed) return
        closed = true
        runCatching { track.removeSink(view) }
        view.release()
    }
}
