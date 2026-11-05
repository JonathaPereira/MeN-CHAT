@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.menchat.nativeapp

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import java.net.URL
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun NativeMedia(model: MainModel, id: String) {
    val state by model.state.collectAsState()
    var manual by remember(id) { mutableStateOf(false) }
    var expanded by remember(id) { mutableStateOf(false) }
    var unavailable by remember(id) { mutableStateOf(false) }
    var media by remember(id) { mutableStateOf<Media?>(null) }
    var url by remember(id) { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val audio by model.audio.state.collectAsState()
    val call by model.calls.state.collectAsState()
    val calling = call.busy || call.active != null
    val save =
        rememberLauncherForActivityResult(
            ActivityResultContracts.CreateDocument("application/octet-stream")
        ) { target ->
            val item = media
            if (target != null && item != null)
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) {
                            val source = model.gateway.signed(item)
                            URL(source)
                                .openConnection()
                                .apply {
                                    connectTimeout = 20000
                                    readTimeout = 20000
                                }
                                .getInputStream()
                                .use { input ->
                                    context.contentResolver.openOutputStream(target)?.use { output
                                        ->
                                        input.copyTo(output)
                                    }
                                }
                        }
                    } catch (cancel: CancellationException) {
                        throw cancel
                    } catch (_: Exception) {
                        model.error("Não foi possível salvar o anexo.")
                    }
                }
        }
    LaunchedEffect(id) {
        try {
            withContext(Dispatchers.IO) { model.gateway.media(id) }.also { media = it }
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            unavailable = true
        }
    }
    val item = media
    if (item == null) {
        Text(
            if (unavailable) "Anexo indisponível" else "Carregando anexo…",
            style = MaterialTheme.typography.bodySmall,
        )
        return
    }
    LaunchedEffect(calling) { if (calling && item.kind != "image") expanded = false }
    if (expanded) {
        DisposableEffect(id) {
            model.mediaCovered = true
            model.audio.stop()
            onDispose { model.mediaCovered = false }
        }
        MediaPreview(
            item.kind,
            item.name,
            { withContext(Dispatchers.IO) { model.gateway.signed(item) } },
            { expanded = false },
        )
    }
    val allowed = manual || state.options.auto(item.kind)
    LaunchedEffect(item.id, allowed) {
        if (item.kind == "image") {
            url = null
            if (allowed)
                while (true) {
                    try {
                        url = withContext(Dispatchers.IO) { model.gateway.signed(item) }
                    } catch (cancel: CancellationException) {
                        throw cancel
                    } catch (_: Exception) {
                        unavailable = true
                    }
                    delay(240_000)
                }
        }
    }
    if (!allowed && item.kind in listOf("image", "audio", "video")) {
        OutlinedButton(onClick = { manual = true }, modifier = Modifier.fillMaxWidth()) {
            Text(
                when (item.kind) {
                    "image" -> "Carregar foto"
                    "audio" -> "Carregar áudio"
                    else -> "Carregar vídeo"
                }
            )
        }
        ChatIconButton(Glyph.Download, "Baixar anexo", onClick = { save.launch(item.name) })
        return
    }
    if (item.kind == "image" && url != null)
        AsyncImage(
            model =
                ImageRequest.Builder(context)
                    .data(url)
                    .diskCachePolicy(CachePolicy.DISABLED)
                    .build(),
            contentDescription = if (item.sticker) "Figurinha" else "Foto enviada",
            modifier =
                Modifier.fillMaxWidth()
                    .heightIn(min = 80.dp, max = if (item.sticker) 180.dp else 250.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(onClickLabel = "Ampliar foto") { expanded = true },
        )
    if (item.kind == "audio") {
        AudioTransport(
            audio,
            id,
            onToggle = {
                if (calling) model.error("Encerre a chamada para ouvir este áudio.")
                else
                    scope.launch {
                        try {
                            if (audio.id == id && url != null) model.audio.toggle(id, url!!)
                            else {
                                val source =
                                    withContext(Dispatchers.IO) { model.gateway.signed(item) }
                                url = source
                                model.audio.toggle(id, source)
                            }
                        } catch (cancel: CancellationException) {
                            throw cancel
                        } catch (_: Exception) {
                            model.error("Áudio indisponível.")
                        }
                    }
            },
            onSeek = model.audio::seek,
            onDownload = { save.launch(item.name) },
        )
    } else if (item.kind == "video")
        OutlinedButton(
            onClick = { expanded = true },
            enabled = !calling,
            modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp),
            shape = RoundedCornerShape(12.dp),
        ) {
            ChatIcon(Glyph.Play, tint = LocalChatPalette.current.accent)
            Spacer(Modifier.width(8.dp))
            Text("Reproduzir vídeo")
        }
    else if (item.kind == "document")
        Text(item.name, maxLines = 2, style = MaterialTheme.typography.bodySmall)
    else if (item.kind == "image" && url == null)
        Text("Foto indisponível", style = MaterialTheme.typography.bodySmall)
    if (item.kind != "audio")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            ChatIconButton(Glyph.Download, "Baixar anexo", onClick = { save.launch(item.name) })
        }
}

@Composable
internal fun AudioTransport(
    audio: AudioState,
    id: String,
    onToggle: () -> Unit,
    onSeek: (Float) -> Unit,
    onDownload: (() -> Unit)?,
) {
    val p = LocalChatPalette.current
    val active = audio.id == id
    Row(
        Modifier.widthIn(min = 220.dp).fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (active && audio.loading)
            Box(Modifier.size(48.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            }
        else
            ChatIconButton(
                if (active && audio.playing) Glyph.Pause else Glyph.Play,
                if (active && audio.playing) "Pausar áudio" else "Reproduzir áudio",
                onClick = onToggle,
            )
        Column(Modifier.weight(1f)) {
            Slider(
                value =
                    if (active)
                        audio.elapsed
                            .toFloat()
                            .coerceIn(0f, audio.duration.coerceAtLeast(1).toFloat())
                    else 0f,
                onValueChange = onSeek,
                valueRange = 0f..(if (active) audio.duration.coerceAtLeast(1).toFloat() else 1f),
                enabled = active && audio.duration > 0,
                modifier = Modifier.height(32.dp),
                thumb = {
                    Box(
                        Modifier.size(12.dp)
                            .background(if (active) p.accent else p.muted, CircleShape)
                    )
                },
                track = { slider ->
                    SliderDefaults.Track(
                        sliderState = slider,
                        modifier = Modifier.height(4.dp),
                        enabled = active && audio.duration > 0,
                        colors =
                            SliderDefaults.colors(
                                activeTrackColor = p.accent,
                                inactiveTrackColor = p.muted.copy(alpha = .2f),
                            ),
                        drawStopIndicator = null,
                        thumbTrackGapSize = 0.dp,
                    )
                },
                colors =
                    SliderDefaults.colors(
                        thumbColor = p.accent,
                        activeTrackColor = p.accent,
                        inactiveTrackColor = p.muted.copy(alpha = .2f),
                    ),
            )
            Text(
                if (active)
                    "${audio.elapsed/60000}:${(audio.elapsed/1000%60).toString().padStart(2,'0')}"
                else "Áudio",
                style = MaterialTheme.typography.labelSmall,
                color = p.muted,
            )
        }
        if (onDownload != null) ChatIconButton(Glyph.Download, "Baixar áudio", onClick = onDownload)
    }
}
