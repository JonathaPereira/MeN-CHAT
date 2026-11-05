package app.menchat.nativeapp

import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import kotlinx.coroutines.CancellationException

/** One viewer owns playback, and releases it when dismissed or its message disappears. */
@Composable
internal fun MediaPreview(
    kind: String,
    name: String,
    source: suspend () -> String,
    close: () -> Unit,
    transport: (@Composable (String) -> Unit)? = null,
) {
    var url by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var scale by remember { mutableFloatStateOf(1f) }
    var x by remember { mutableFloatStateOf(0f) }
    var y by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(Unit) {
        try {
            url = source()
            if (kind !in listOf("image", "video")) loading = false
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            failed = true
            loading = false
        }
    }
    Dialog(
        onDismissRequest = close,
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = Color(0xFF0B1712)) {
            Column(Modifier.fillMaxSize().safeDrawingPadding()) {
                Row(
                    Modifier.fillMaxWidth().padding(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        when (kind) {
                            "image" -> "Foto"
                            "video" -> "Vídeo"
                            "audio" -> "Áudio"
                            else -> "Anexo"
                        },
                        Modifier.weight(1f).padding(start = 12.dp),
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                    )
                    if (kind == "image" && scale != 1f)
                        TextButton(
                            onClick = {
                                scale = 1f
                                x = 0f
                                y = 0f
                            }
                        ) {
                            Text("Restaurar")
                        }
                    ChatIconButton(Glyph.Close, "Fechar visualização", onClick = close)
                }
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    val uri = url
                    if (uri != null && !failed)
                        when (kind) {
                            "image" ->
                                AsyncImage(
                                    model =
                                        ImageRequest.Builder(LocalContext.current)
                                            .data(uri)
                                            .diskCachePolicy(CachePolicy.DISABLED)
                                            .build(),
                                    contentDescription = "Foto ampliada",
                                    contentScale = ContentScale.Fit,
                                    onSuccess = { loading = false },
                                    onError = {
                                        failed = true
                                        loading = false
                                    },
                                    modifier =
                                        Modifier.fillMaxSize()
                                            .pointerInput(Unit) {
                                                detectTransformGestures { _, pan, zoom, _ ->
                                                    scale = (scale * zoom).coerceIn(1f, 4f)
                                                    val limitX = size.width * (scale - 1) / 2f
                                                    val limitY = size.height * (scale - 1) / 2f
                                                    x = (x + pan.x).coerceIn(-limitX, limitX)
                                                    y = (y + pan.y).coerceIn(-limitY, limitY)
                                                }
                                            }
                                            .graphicsLayer {
                                                scaleX = scale
                                                scaleY = scale
                                                translationX = x
                                                translationY = y
                                            },
                                )
                            "video" ->
                                PreviewVideo(
                                    uri,
                                    { loading = false },
                                    {
                                        failed = true
                                        loading = false
                                    },
                                )
                            "audio" -> {
                                Box(Modifier.padding(24.dp)) { transport?.invoke(uri) }
                            }
                            else -> {
                                Text(name, Modifier.padding(24.dp), color = Color.White)
                            }
                        }
                    if (loading && !failed)
                        CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 2.dp)
                    if (failed)
                        Text(
                            "Não foi possível abrir esta mídia.",
                            Modifier.padding(24.dp),
                            color = Color.White,
                        )
                }
                if (kind == "image" && !failed)
                    Text(
                        "Use dois dedos para ampliar",
                        Modifier.align(Alignment.CenterHorizontally).padding(16.dp),
                        color = Color(0xFF9CAE9F),
                        style = MaterialTheme.typography.bodySmall,
                    )
            }
        }
    }
}

@Composable
private fun PreviewVideo(url: String, ready: () -> Unit, failed: () -> Unit) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val player = remember(url) { VideoView(context) }
    DisposableEffect(player, lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) player.pause()
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            player.stopPlayback()
        }
    }
    AndroidView(
        factory = {
            player.apply {
                setMediaController(MediaController(context).also { it.setAnchorView(this) })
                setOnPreparedListener {
                    ready()
                    if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) start()
                }
                setOnErrorListener { _, _, _ ->
                    failed()
                    true
                }
                setVideoPath(url)
            }
        },
        modifier = Modifier.fillMaxSize().background(Color.Black),
    )
}

@Composable
internal fun LocalMediaPreview(model: MainModel, file: LocalAttachment, close: () -> Unit) {
    DisposableEffect(file.file) {
        model.mediaCovered = true
        model.audio.stop()
        onDispose {
            model.mediaCovered = false
            model.audio.stop()
        }
    }
    val audio by model.audio.state.collectAsState()
    val id = "draft:${file.file.name}"
    MediaPreview(
        file.kind,
        file.name,
        { file.file.toURI().toString() },
        close,
        transport = { uri ->
            AudioTransport(audio, id, { model.audio.toggle(id, uri) }, model.audio::seek, null)
        },
    )
}
