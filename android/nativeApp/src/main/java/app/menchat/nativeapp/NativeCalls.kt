package app.menchat.nativeapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import java.util.UUID
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

internal data class NativeCallState(
    val ready: Boolean = false,
    val busy: Boolean = false,
    val active: CallSnapshot? = null,
    val incoming: CallHeader? = null,
    val mic: Boolean = true,
    val video: Boolean = false,
    val speaker: Boolean = false,
    val connected: Set<String> = emptySet(),
    val revision: Long = 0,
    val error: String? = null,
    val expanded: Boolean = true,
)

internal class NativeCalls(
    private val context: Context,
    private val gateway: Gateway,
    private val preferences: NativePreferences,
    private val transport: CallTransport = CallGateway(gateway, preferences.installation),
    private val mediaFactory: CallMediaFactory =
        CallMediaFactory { actor, ice, video, noise, events ->
            NativeRtc(
                context,
                actor,
                ice,
                video,
                noise,
                events.publish,
                events.changed,
                events.failed,
            )
        },
    private val life: CallLifeSupport =
        object : CallLifeSupport {
            override fun start(video: Boolean, end: () -> Unit) {
                NativeCallService.start(context, video, end)
            }

            override fun stop() {
                NativeCallService.stop(context)
            }
        },
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutable = MutableStateFlow(NativeCallState())
    val state = mutable.asStateFlow()
    var engine: CallMedia? = null
        private set

    private var actor: String? = null
    private var callId: String? = null
    private var epoch = 0L
    private var polling: Job? = null
    private var pending: Job? = null
    private var foreground = false
    private var cursor = 0L
    private var lastContact = 0L
    private var nextIce = 0L
    private var lastIncoming: String? = null

    private fun change(value: (NativeCallState) -> NativeCallState) {
        mutable.value = value(mutable.value)
    }

    fun bind(id: String, ready: Boolean) {
        if (actor != null && actor != id) end()
        actor = id
        change { it.copy(ready = ready) }
        if (ready && polling?.isActive != true)
            polling = scope.launch {
                while (isActive) {
                    if (foreground || callId != null) poll()
                    delay(if (callId == null) 2500 else 1000)
                }
            }
    }

    fun foreground(value: Boolean) {
        foreground = value
    }

    fun expand(value: Boolean = true) {
        change { it.copy(expanded = value) }
    }

    fun clearError() {
        change { it.copy(error = null) }
    }

    private suspend fun poll() {
        if (state.value.busy) return
        val generation = epoch
        val id = callId
        try {
            if (id == null) {
                val rows = withContext(Dispatchers.IO) { transport.inbox() }
                if (generation != epoch || actor == null) return
                val incoming =
                    rows.firstOrNull { it.mine == "joined" }
                        ?: rows.firstOrNull { it.mine == "invited" }
                change { it.copy(incoming = incoming) }
                if (incoming != null && lastIncoming != incoming.id) {
                    lastIncoming = incoming.id
                    val options = preferences.read(actor)
                    if (options.notify(incoming.thread, false)) {
                        val alerts = NativeNotifications(context)
                        if (options.sound) alerts.sound()
                        if (options.vibration) alerts.vibrate()
                    }
                }
            } else {
                val snapshot =
                    withContext(Dispatchers.IO) {
                        transport.state(id, state.value.mic, state.value.video)
                    }
                if (generation != epoch || callId != id) return
                lastContact = SystemClock.elapsedRealtime()
                change { it.copy(active = snapshot) }
                engine?.reconcile(snapshot.members)
                val rows = withContext(Dispatchers.IO) { transport.signals(id, cursor) }
                for (signal in rows) {
                    if (generation != epoch || callId != id) return
                    engine?.receive(signal)
                    cursor = signal.seq
                }
                if (SystemClock.elapsedRealtime() > nextIce) {
                    nextIce = SystemClock.elapsedRealtime() + 30_000
                    try {
                        val ice = withContext(Dispatchers.IO) { transport.configuration() }
                        if (generation == epoch) {
                            engine?.renew(ice)
                            nextIce = SystemClock.elapsedRealtime() + 15 * 60_000
                        }
                    } catch (cancel: CancellationException) {
                        throw cancel
                    } catch (_: Exception) {
                        change {
                            it.copy(
                                error = "Não foi possível renovar a conexão. Tentando novamente."
                            )
                        }
                    }
                }
            }
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (error: Exception) {
            if (generation != epoch) return
            if (id != null) {
                if (
                    (error is NativeApiException && error.status in listOf(400, 401, 403, 404)) ||
                        SystemClock.elapsedRealtime() - lastContact > 40_000
                ) {
                    release()
                    change {
                        it.copy(
                            active = null,
                            incoming = null,
                            busy = false,
                            error = "A chamada terminou ou seu acesso foi encerrado.",
                        )
                    }
                } else
                    change { it.copy(error = "Conexão instável. Tentando sincronizar a chamada…") }
            }
        }
    }

    fun start(thread: String, video: Boolean) = begin(thread, null, video)

    fun accept() {
        val incoming = state.value.incoming ?: return
        begin(incoming.thread, incoming.id, incoming.video)
    }

    private fun begin(thread: String, incoming: String?, video: Boolean) {
        val owner = actor ?: return
        if (state.value.busy || callId != null || !state.value.ready) return
        if (
            context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) !=
                PackageManager.PERMISSION_GRANTED ||
                (video &&
                    context.checkSelfPermission(Manifest.permission.CAMERA) !=
                        PackageManager.PERMISSION_GRANTED)
        ) {
            change {
                it.copy(error = "Permita o microfone e, para vídeo, a câmera antes de iniciar.")
            }
            return
        }
        val generation = ++epoch
        val id = incoming ?: UUID.randomUUID().toString()
        change { it.copy(busy = true, error = null, expanded = true) }
        pending = scope.launch {
            var acquired: CallMedia? = null
            try {
                val ice = withContext(Dispatchers.IO) { transport.configuration() }
                if (generation != epoch) return@launch
                check(foreground) { "Open the app to start a call" }
                life.start(video) { end() }
                acquired =
                    mediaFactory.create(
                        owner,
                        ice,
                        video,
                        preferences.read(owner).noiseSuppression,
                        events =
                            CallMediaEvents(
                                publish = { to, device, signal, kind, payload ->
                                    if (generation == epoch && actor == owner)
                                        transport.signal(id, to, device, signal, kind, payload)
                                },
                                changed = {
                                    scope.launch { if (generation == epoch) rtcUpdated() }
                                },
                                failed = { message ->
                                    scope.launch {
                                        if (generation == epoch) change { it.copy(error = message) }
                                    }
                                },
                            ),
                    )
                if (generation != epoch) {
                    acquired.close()
                    return@launch
                }
                engine = acquired
                acquired = null
                withContext(Dispatchers.IO) {
                    if (incoming == null) transport.start(id, thread, video) else transport.join(id)
                }
                if (generation != epoch) {
                    withContext(Dispatchers.IO) { runCatching { transport.leave(id) } }
                    return@launch
                }
                callId = id
                cursor = 0
                lastContact = SystemClock.elapsedRealtime()
                nextIce = lastContact + 15 * 60_000
                val snapshot = withContext(Dispatchers.IO) { transport.state(id, true, video) }
                if (generation != epoch) return@launch
                change {
                    it.copy(
                        active = snapshot,
                        incoming = null,
                        busy = false,
                        mic = true,
                        video = video,
                        speaker = video,
                    )
                }
                engine?.reconcile(snapshot.members)
                rtcUpdated()
                if (incoming == null)
                    scope.launch {
                        withContext(Dispatchers.IO) { runCatching { transport.dispatch(id) } }
                    }
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (_: Exception) {
                if (generation == epoch) {
                    release()
                    change {
                        it.copy(
                            busy = false,
                            active = null,
                            error =
                                "Não foi possível iniciar. Confira permissões e conexão; a chamada pode estar cheia, encerrada ou o contato ocupado.",
                        )
                    }
                }
                withContext(Dispatchers.IO) { runCatching { transport.leave(id) } }
            } finally {
                acquired?.close()
                if (generation != epoch)
                    withContext(NonCancellable + Dispatchers.IO) {
                        runCatching { transport.leave(id) }
                    }
            }
        }
    }

    private fun rtcUpdated() {
        val rtc = engine ?: return
        change {
            it.copy(
                mic = rtc.micOn,
                video = rtc.cameraOn,
                speaker = rtc.speakerOn,
                connected = rtc.connected(),
                revision = it.revision + 1,
            )
        }
    }

    fun microphone() {
        engine?.microphone(!state.value.mic)
    }

    fun camera() {
        runCatching { engine?.camera(!state.value.video) }
            .onFailure {
                change {
                    it.copy(
                        error = "Não foi possível ligar a câmera. Confira a permissão do Android."
                    )
                }
            }
        rtcUpdated()
    }

    fun switchCamera() {
        engine?.switchCamera()
    }

    fun speaker() {
        engine?.route(!state.value.speaker)
    }

    fun decline() {
        val incoming = state.value.incoming ?: return
        change { it.copy(incoming = null) }
        scope.launch {
            withContext(Dispatchers.IO) { runCatching { transport.leave(incoming.id) } }
        }
    }

    fun end() {
        val id = callId ?: state.value.incoming?.id
        epoch++
        pending?.cancel()
        pending = null
        release()
        change { NativeCallState(ready = it.ready) }
        if (id != null)
            scope.launch { withContext(Dispatchers.IO) { runCatching { transport.leave(id) } } }
    }

    private fun release() {
        callId = null
        engine?.close()
        engine = null
        life.stop()
        cursor = 0
        change { it.copy(connected = emptySet(), revision = it.revision + 1) }
    }

    suspend fun logout() {
        val id = callId ?: state.value.incoming?.id
        epoch++
        pending?.cancel()
        pending = null
        release()
        polling?.cancel()
        polling = null
        actor = null
        change { NativeCallState() }
        if (id != null) withContext(Dispatchers.IO) { runCatching { transport.leave(id) } }
    }

    fun close() {
        val id = callId
        end()
        polling?.cancel()
        if (id != null)
            CoroutineScope(Dispatchers.IO).launch { runCatching { transport.leave(id) } }
        scope.cancel()
    }
}
