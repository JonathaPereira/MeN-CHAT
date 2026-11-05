package app.menchat.nativeapp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.compose.foundation.Canvas as ComposeCanvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import java.io.File
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal data class NativeSticker(val id: String, val file: File)

internal data class StickerCrop(
    val zoom: Float = 1f,
    val x: Float = 0f,
    val y: Float = 0f,
    val turns: Int = 0,
    val fill: Boolean = false,
)

internal object StickerDrawing {
    fun draw(canvas: Canvas, bitmap: Bitmap, side: Float, crop: StickerCrop) {
        val rotated = crop.turns % 2 != 0
        val width = (if (rotated) bitmap.height else bitmap.width).toFloat()
        val height = (if (rotated) bitmap.width else bitmap.height).toFloat()
        val base =
            if (crop.fill) maxOf(side / width, side / height)
            else minOf(side / width, side / height)
        val scale = base * crop.zoom.coerceIn(1f, 4f)
        val dx = ((width * scale - side) / 2).coerceAtLeast(0f) * crop.x.coerceIn(-1f, 1f)
        val dy = ((height * scale - side) / 2).coerceAtLeast(0f) * crop.y.coerceIn(-1f, 1f)
        canvas.save()
        canvas.clipRect(0f, 0f, side, side)
        canvas.translate(side / 2 + dx, side / 2 + dy)
        canvas.rotate((crop.turns % 4) * 90f)
        canvas.scale(scale, scale)
        canvas.translate(-bitmap.width / 2f, -bitmap.height / 2f)
        canvas.drawBitmap(bitmap, 0f, 0f, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        canvas.restore()
    }

    @Suppress("DEPRECATION")
    fun save(bitmap: Bitmap, target: File, crop: StickerCrop) {
        val output = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888)
        try {
            draw(Canvas(output), bitmap, 512f, crop)
            for (quality in listOf(90, 80, 65, 45)) {
                target.outputStream().use {
                    output.compress(Bitmap.CompressFormat.WEBP, quality, it)
                }
                if (target.length() in 1..100_000) return
            }
            error("A figurinha ficou grande demais. Tente outro recorte ou imagem.")
        } finally {
            output.recycle()
        }
    }
}

internal class NativeStickerShelf(private val context: Context) {
    private fun root(actor: String): File {
        require(NativeNotifications.uuid.matches(actor)) { "Conta indisponível." }
        return File(File(context.filesDir, "menchat-stickers"), actor).apply { mkdirs() }
    }

    fun list(actor: String): List<NativeSticker> =
        root(actor)
            .listFiles()
            ?.filter { Regex("[a-f0-9-]{36}\\.webp").matches(it.name) && it.length() in 1..100_000 }
            ?.sortedByDescending { it.lastModified() }
            ?.take(40)
            ?.map { NativeSticker(it.nameWithoutExtension, it) } ?: emptyList()

    fun save(actor: String, bitmap: Bitmap, crop: StickerCrop): NativeSticker {
        require(list(actor).size < 40) {
            "Sua coleção tem 40 figurinhas. Remova uma antes de criar outra."
        }
        val id = UUID.randomUUID().toString()
        val file = File(root(actor), "$id.webp")
        try {
            StickerDrawing.save(bitmap, file, crop)
            return NativeSticker(id, file)
        } catch (error: Exception) {
            file.delete()
            throw error
        }
    }

    fun remove(actor: String, item: NativeSticker) {
        require(item.file.canonicalFile.parentFile == root(actor).canonicalFile)
        item.file.delete()
    }
}

@Composable
internal fun NativeStickerPicker(
    items: List<NativeSticker>,
    busy: Boolean,
    create: () -> Unit,
    choose: (NativeSticker) -> Unit,
    remove: (NativeSticker) -> Unit,
    close: () -> Unit,
) {
    val context = LocalContext.current
    CollectionDialog("Figurinhas", close) {
        OutlinedButton(onClick = create, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
            ChatIcon(Glyph.Plus)
            Spacer(Modifier.width(8.dp))
            Text("Criar ou importar imagem")
        }
        Text(
            "Até 40 figurinhas neste aparelho. Imagens estáticas; pacotes do WhatsApp não são importados automaticamente.",
            style = MaterialTheme.typography.bodySmall,
            color = LocalChatPalette.current.muted,
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items.forEach { item ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Surface(
                        onClick = { choose(item) },
                        enabled = !busy,
                        color = LocalChatPalette.current.soft,
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                        modifier = Modifier.size(116.dp),
                    ) {
                        AsyncImage(
                            ImageRequest.Builder(context)
                                .data(item.file)
                                .diskCachePolicy(CachePolicy.DISABLED)
                                .build(),
                            "Selecionar figurinha",
                            modifier = Modifier.padding(8.dp),
                        )
                    }
                    TextButton(onClick = { remove(item) }, enabled = !busy) { Text("Remover") }
                }
            }
        }
    }
}

@Composable
internal fun NativeStickerEditor(
    source: LocalAttachment,
    busy: Boolean,
    save: (Bitmap, StickerCrop) -> Unit,
    close: () -> Unit,
) {
    val context = LocalContext.current
    var bitmap by remember(source.file) { mutableStateOf<Bitmap?>(null) }
    var error by remember { mutableStateOf(false) }
    var crop by remember { mutableStateOf(StickerCrop()) }
    LaunchedEffect(source.file) {
        var result: Bitmap? = null
        try {
            withContext(Dispatchers.IO) {
                result = NativeLocalMedia(context).stickerBitmap(source.file)
            }
            bitmap = result
            result = null
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            error = true
        } finally {
            result?.recycle()
        }
    }
    DisposableEffect(bitmap) {
        val item = bitmap
        onDispose { item?.recycle() }
    }
    CollectionDialog("Criar figurinha", { if (!busy) close() }) {
        if (error) Text("Não foi possível preparar esta imagem.")
        val image = bitmap
        if (image == null && !error) CircularProgressIndicator()
        if (image != null) {
            ComposeCanvas(Modifier.fillMaxWidth().aspectRatio(1f)) {
                StickerDrawing.draw(drawContext.canvas.nativeCanvas, image, size.width, crop)
            }
            SettingToggle("Preencher e recortar", crop.fill, !busy) { crop = crop.copy(fill = it) }
            Text("Zoom", style = MaterialTheme.typography.labelLarge)
            Slider(crop.zoom, { crop = crop.copy(zoom = it) }, valueRange = 1f..4f, enabled = !busy)
            Text("Posição horizontal", style = MaterialTheme.typography.labelLarge)
            Slider(crop.x, { crop = crop.copy(x = it) }, valueRange = -1f..1f, enabled = !busy)
            Text("Posição vertical", style = MaterialTheme.typography.labelLarge)
            Slider(crop.y, { crop = crop.copy(y = it) }, valueRange = -1f..1f, enabled = !busy)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { crop = crop.copy(turns = (crop.turns + 1) % 4) },
                    enabled = !busy,
                ) {
                    Text("Girar")
                }
                TextButton(onClick = { crop = StickerCrop() }, enabled = !busy) {
                    Text("Restaurar")
                }
            }
            Button(
                onClick = { save(image, crop) },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Salvar figurinha")
            }
        }
    }
}
