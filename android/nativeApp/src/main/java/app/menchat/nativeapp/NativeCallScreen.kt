package app.menchat.nativeapp

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.webrtc.VideoTrack

@Composable
internal fun rememberCallPermission(model: MainModel): (Boolean, Boolean) -> Unit {
    val context = LocalContext.current
    var actor by rememberSaveable { mutableStateOf<String?>(null) }
    var thread by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingCall by rememberSaveable { mutableStateOf<String?>(null) }
    var video by rememberSaveable { mutableStateOf(false) }
    var accept by rememberSaveable { mutableStateOf(false) }
    fun complete(granted: Boolean) {
        val state = model.state.value
        if (
            actor != null &&
                state.account?.id == actor &&
                model.foreground &&
                ((accept && model.calls.state.value.incoming?.id == pendingCall) ||
                    (!accept && state.selected?.id == thread))
        ) {
            if (granted) {
                model.audio.stop()
                if (accept) model.calls.accept() else thread?.let { model.calls.start(it, video) }
            } else
                model.error(
                    "Permita o microfone e, para vídeo, a câmera nas configurações do Android."
                )
        }
        actor = null
    }
    val launcher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            result ->
            complete(
                result[Manifest.permission.RECORD_AUDIO] == true &&
                    (!video || result[Manifest.permission.CAMERA] == true)
            )
        }
    return { isVideo, answer ->
        val state = model.state.value
        if ((!state.busy || answer) && !state.recording && state.account != null) {
            actor = state.account.id
            thread = state.selected?.id
            video = isVideo
            accept = answer
            pendingCall = model.calls.state.value.incoming?.id
            val permissions =
                if (isVideo) arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA)
                else arrayOf(Manifest.permission.RECORD_AUDIO)
            if (
                permissions.all {
                    context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED
                }
            )
                complete(true)
            else launcher.launch(permissions)
        }
    }
}

@Composable
internal fun NativeCallScreen(
    calls: NativeCalls,
    state: NativeCallState,
    actor: String,
    permission: (Boolean, Boolean) -> Unit,
) {
    val active = state.active
    val incoming = state.incoming
    if (state.busy)
        AlertDialog(
            onDismissRequest = calls::end,
            title = { Text("Preparando chamada") },
            text = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                    Text("Conectando dispositivos…")
                }
            },
            confirmButton = { TextButton(onClick = calls::end) { Text("Cancelar") } },
        )
    else if (incoming != null && active == null)
        AlertDialog(
            onDismissRequest = calls::decline,
            title = { Text(if (incoming.video) "Chamada de vídeo" else "Chamada de voz") },
            text = { Text("Você está recebendo uma chamada pelo MenChat.") },
            confirmButton = {
                Button(onClick = { permission(incoming.video, true) }) {
                    Text(if (incoming.mine == "joined") "Retomar" else "Atender")
                }
            },
            dismissButton = { TextButton(onClick = calls::decline) { Text("Recusar") } },
        )
    if (active != null && state.expanded) {
        val engine = calls.engine
        val others = active.members.filter { it.id != actor }
        val maximizedMember =
            if (state.maximized != null && state.maximized != "self")
                others.firstOrNull {
                    it.id == state.maximized && it.state == "joined" && it.video
                }
            else null
        val isSelfMaximized =
            state.maximized == "self" && active.header.video && state.video
        if (isSelfMaximized || maximizedMember != null) {
            val title =
                if (isSelfMaximized) "Você · tela maximizada"
                else "${maximizedMember!!.name} · tela maximizada"
            val track =
                if (isSelfMaximized) engine?.localVideo
                else engine?.remoteVideo(maximizedMember!!.id)
            androidx.compose.ui.window.Dialog(
                onDismissRequest = { calls.maximize(null) },
                properties =
                    androidx.compose.ui.window.DialogProperties(
                        usePlatformDefaultWidth = false,
                        decorFitsSystemWindows = false,
                    ),
            ) {
                Surface(
                    Modifier.fillMaxSize(),
                    color = LocalChatPalette.current.canvas,
                ) {
                    Column(
                        Modifier.fillMaxSize().safeDrawingPadding().padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Row(
                            Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Row(
                                modifier = Modifier.weight(1f),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                ChatIconButton(
                                    Glyph.Back,
                                    "Restaurar tela",
                                    onClick = { calls.maximize(null) },
                                )
                                Text(
                                    title,
                                    style = MaterialTheme.typography.titleMedium,
                                )
                            }
                            OutlinedButton(onClick = { calls.maximize(null) }) {
                                Text("Restaurar tela")
                            }
                        }
                        Surface(
                            Modifier.weight(1f).fillMaxWidth(),
                            color = LocalChatPalette.current.panel,
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp),
                        ) {
                            Box(
                                Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (engine != null && track != null)
                                    NativeCallVideo(
                                        engine,
                                        track,
                                        isSelfMaximized,
                                        fullScreen = true,
                                    )
                                else if (isSelfMaximized)
                                    Text(
                                        "Você${if(state.mic)"" else " · microfone desligado"}",
                                        style = MaterialTheme.typography.titleLarge,
                                    )
                                else if (maximizedMember != null)
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        ChatAvatar(
                                            maximizedMember.name,
                                            false,
                                            88,
                                            maximizedMember.avatar,
                                        )
                                        Text(
                                            maximizedMember.name,
                                            style = MaterialTheme.typography.titleLarge,
                                        )
                                    }
                            }
                        }
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (!isSelfMaximized && active.header.video && state.video) {
                                OutlinedButton(onClick = { calls.maximize("self") }) {
                                    Text("Maximizar minha tela")
                                }
                            }
                            others
                                .filter {
                                    it.state == "joined" &&
                                        it.video &&
                                        it.id != maximizedMember?.id
                                }
                                .forEach { person ->
                                    OutlinedButton(onClick = { calls.maximize(person.id) }) {
                                        Text("Maximizar tela de ${person.name}")
                                    }
                                }
                        }
                        NativeCallControlsRow(calls, state, active.header.video)
                        Button(onClick = calls::end, modifier = Modifier.fillMaxWidth()) {
                            Text("Encerrar chamada")
                        }
                        state.error?.let {
                            Text(
                                it,
                                color = LocalChatPalette.current.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }
        } else {
            CollectionDialog(
                if (active.header.video) "Chamada de vídeo" else "Chamada de voz",
                { calls.expand(false) },
            ) {
                Text(
                    if (active.header.state == "ringing") "Chamando…"
                    else "Em chamada · até 4 pessoas",
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalChatPalette.current.muted,
                )
                Surface(
                    color = LocalChatPalette.current.panel,
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                ) {
                    Column(
                        Modifier.fillMaxWidth().padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (active.header.video && state.video && engine?.localVideo != null)
                            NativeCallVideo(engine, engine.localVideo!!, true)
                        Text(
                            "Você${if(state.mic)"" else " · microfone desligado"}",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        if (active.header.video && state.video) {
                            OutlinedButton(onClick = { calls.maximize("self") }) {
                                Text("Maximizar minha tela")
                            }
                        }
                    }
                }
                others.forEach { person ->
                    val track = engine?.remoteVideo(person.id)
                    Surface(
                        color = LocalChatPalette.current.panel,
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                    ) {
                        Column(
                            Modifier.fillMaxWidth().padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            if (person.video && track != null)
                                NativeCallVideo(engine, track, false)
                            else ChatAvatar(person.name, false, 64, person.avatar)
                            Text(person.name, style = MaterialTheme.typography.titleMedium)
                            Text(
                                when {
                                    person.state == "invited" -> "Chamando…"
                                    person.state != "joined" -> "Indisponível"
                                    person.id in state.connected ->
                                        if (person.mic) "Conectado" else "Microfone desligado"
                                    else -> "Conectando…"
                                },
                                color = LocalChatPalette.current.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                            if (
                                active.header.video &&
                                    person.video &&
                                    person.state == "joined"
                            ) {
                                OutlinedButton(onClick = { calls.maximize(person.id) }) {
                                    Text("Maximizar tela de ${person.name}")
                                }
                            }
                        }
                    }
                }
                NativeCallControlsRow(calls, state, active.header.video)
                Button(onClick = calls::end, modifier = Modifier.fillMaxWidth()) {
                    Text("Encerrar chamada")
                }
                state.error?.let {
                    Text(
                        it,
                        color = LocalChatPalette.current.muted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
    if (state.error != null && active == null && !state.busy)
        AlertDialog(
            onDismissRequest = calls::clearError,
            title = { Text("Chamada indisponível") },
            text = { Text(state.error) },
            confirmButton = { TextButton(onClick = calls::clearError) { Text("Entendi") } },
        )
}

@Composable
private fun NativeCallControlsRow(
    calls: NativeCalls,
    state: NativeCallState,
    videoCall: Boolean,
) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = calls::microphone) {
            Text(if (state.mic) "Silenciar" else "Ativar microfone")
        }
        OutlinedButton(onClick = calls::speaker) {
            Text(if (state.speaker) "Usar fone" else "Viva-voz")
        }
        if (videoCall) {
            OutlinedButton(onClick = calls::camera) {
                Text(if (state.video) "Desligar câmera" else "Ligar câmera")
            }
            OutlinedButton(onClick = calls::switchCamera, enabled = state.video) {
                Text("Alternar câmera")
            }
        }
    }
}

@Composable
private fun NativeCallVideo(
    engine: CallMedia,
    track: VideoTrack,
    mirror: Boolean,
    fullScreen: Boolean = false,
) {
    val context = LocalContext.current
    val renderer = remember(engine, track) { engine.renderer(context, track, mirror) }
    DisposableEffect(renderer) { onDispose { engine.releaseRenderer(renderer) } }
    AndroidView(
        factory = { renderer.view },
        modifier =
            if (fullScreen) Modifier.fillMaxSize()
            else Modifier.fillMaxWidth().aspectRatio(4f / 3f),
    )
}
