package app.menchat.nativeapp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.io.InputStream
import java.util.UUID

internal data class LocalAttachment(
    val file: File,
    val name: String,
    val mime: String,
    val kind: String,
    val sticker: Boolean = false,
) {
    val bytes
        get() = file.length()
}

internal object NativeMediaPolicy {
    val types =
        mapOf(
            "image/jpeg" to "image",
            "image/png" to "image",
            "image/webp" to "image",
            "image/gif" to "image",
            "video/mp4" to "video",
            "video/webm" to "video",
            "video/quicktime" to "video",
            "audio/mpeg" to "audio",
            "audio/mp4" to "audio",
            "audio/ogg" to "audio",
            "audio/wav" to "audio",
            "audio/webm" to "audio",
            "application/pdf" to "document",
            "text/plain" to "document",
            "application/zip" to "document",
            "application/x-zip-compressed" to "document",
            "application/msword" to "document",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" to "document",
            "application/vnd.ms-excel" to "document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" to "document",
        )

    fun limit(kind: String) =
        when (kind) {
            "image" -> 5_000_000L
            "video" -> 25_000_000L
            "avatar" -> 200_000L
            else -> 10_000_000L
        }

    fun check(name: String, mime: String, bytes: Long): String {
        val kind = types[mime] ?: error("Tipo de arquivo não permitido.")
        require(
            name.isNotBlank() &&
                name.length <= 180 &&
                name.none { it.isISOControl() } &&
                !Regex("(?i)\\.(exe|msi|bat|cmd|ps1|js|html|svg|sh)$").containsMatchIn(name)
        ) {
            "Nome de arquivo não permitido."
        }
        require(bytes in 1..limit(kind)) {
            "Arquivo vazio ou acima do limite: fotos 5 MB, vídeos 25 MB, áudios e documentos 10 MB."
        }
        return kind
    }
}

internal class NativeLocalMedia(private val context: Context) {
    private val drafts = File(context.cacheDir, "menchat-drafts").apply { mkdirs() }

    init {
        val stale = System.currentTimeMillis() - 86_400_000
        listOf(drafts, File(context.cacheDir, "menchat-capture")).forEach { dir ->
            dir.listFiles()
                ?.filter { it.isFile && it.lastModified() < stale }
                ?.forEach { it.delete() }
        }
    }

    fun temp(extension: String) = File(drafts, "${UUID.randomUUID()}.$extension")

    fun import(uri: Uri, avatar: Boolean = false): LocalAttachment {
        require(uri.scheme == "content") { "Escolha um arquivo pelo seletor do Android." }
        val resolver = context.contentResolver
        val mime =
            resolver.getType(uri)?.lowercase()?.substringBefore(';')?.let {
                when (it) {
                    "image/jpg" -> "image/jpeg"
                    "audio/x-wav" -> "audio/wav"
                    "audio/x-m4a" -> "audio/mp4"
                    else -> it
                }
            } ?: error("Não foi possível identificar o arquivo.")
        val kind = NativeMediaPolicy.types[mime] ?: error("Tipo de arquivo não permitido.")
        if (avatar)
            require(mime in listOf("image/jpeg", "image/png", "image/webp")) {
                "Escolha JPG, PNG ou WebP de até 2 MB."
            }
        var name = "anexo"
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
            if (it.moveToFirst()) name = it.getString(0) ?: name
        }
        name = name.substringAfterLast('/').substringAfterLast('\\')
        require(name.length <= 180 && name.none { it.isISOControl() }) {
            "Nome de arquivo não permitido."
        }
        val file = temp("upload")
        try {
            resolver.openInputStream(uri)?.use {
                copyBounded(it, file, if (avatar) 2_000_000 else NativeMediaPolicy.limit(kind))
            } ?: error("Não foi possível ler o arquivo.")
            NativeMediaPolicy.check(name, mime, file.length())
            if (avatar) return avatar(file).also { file.delete() }
            return LocalAttachment(file, name, mime, kind)
        } catch (error: Exception) {
            file.delete()
            throw error
        }
    }

    fun captured(file: File, video: Boolean, avatar: Boolean): LocalAttachment {
        require(file.length() in 1..25_000_000) { "Captura vazia ou maior que 25 MB." }
        if (video) {
            require(!avatar)
            val reader = MediaMetadataRetriever()
            val duration =
                try {
                    reader.setDataSource(file.absolutePath)
                    reader
                        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                        ?.toLongOrNull()
                } finally {
                    reader.release()
                }
            require(duration != null && duration in 1..120_000) {
                "Grave um vídeo de até dois minutos."
            }
            val copy = temp("mp4")
            try {
                file.inputStream().use { copyBounded(it, copy, 25_000_000) }
                return LocalAttachment(copy, "video.mp4", "video/mp4", "video")
            } catch (error: Exception) {
                copy.delete()
                throw error
            }
        }
        val image = decodeSampled(file, 2048, 60_000_000)
        try {
            val output = temp("jpg")
            try {
                val normalized = orient(image, file)
                try {
                    output.outputStream().use {
                        normalized.compress(Bitmap.CompressFormat.JPEG, if (avatar) 75 else 85, it)
                    }
                } finally {
                    if (normalized !== image) normalized.recycle()
                }
                require(output.length() in 1..(if (avatar) 2_000_000 else 5_000_000)) {
                    "A foto ficou muito grande. Escolha uma resolução menor."
                }
                if (avatar) return avatar(output).also { output.delete() }
                return LocalAttachment(output, "foto.jpg", "image/jpeg", "image")
            } catch (error: Exception) {
                output.delete()
                throw error
            }
        } finally {
            image.recycle()
        }
    }

    @Suppress("DEPRECATION")
    private fun avatar(file: File): LocalAttachment {
        require(file.length() in 1..2_000_000) { "Escolha uma foto de até 2 MB." }
        val bitmap = decodeSampled(file, 512, 20_000_000)
        val oriented = orient(bitmap, file)
        val crop = minOf(oriented.width, oriented.height)
        val square =
            Bitmap.createBitmap(
                oriented,
                (oriented.width - crop) / 2,
                (oriented.height - crop) / 2,
                crop,
                crop,
            )
        val scaled = Bitmap.createScaledBitmap(square, 256, 256, true)
        val output = temp("webp")
        try {
            output.outputStream().use { scaled.compress(Bitmap.CompressFormat.WEBP, 85, it) }
            require(output.length() in 1..200_000) { "Escolha outra foto de perfil." }
            return LocalAttachment(output, "perfil.webp", "image/webp", "avatar")
        } catch (error: Exception) {
            output.delete()
            throw error
        } finally {
            listOf(scaled, square, oriented, bitmap).distinct().forEach { it.recycle() }
        }
    }

    fun stickerBitmap(file: File): Bitmap {
        val source = decodeSampled(file, 1024, 20_000_000)
        val result = orient(source, file)
        if (result !== source) source.recycle()
        return result
    }

    private fun decodeSampled(file: File, size: Int, pixels: Long): Bitmap {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        require(
            bounds.outWidth > 0 &&
                bounds.outHeight > 0 &&
                bounds.outWidth.toLong() * bounds.outHeight <= pixels
        ) {
            "Imagem inválida ou com resolução muito alta."
        }
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / sample > size) sample *= 2
        return BitmapFactory.decodeFile(
            file.absolutePath,
            BitmapFactory.Options().apply { inSampleSize = sample },
        ) ?: error("Não foi possível preparar a imagem.")
    }

    private fun orient(bitmap: Bitmap, file: File): Bitmap {
        val orientation = runCatching {
            ExifInterface(file)
                .getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                )
        }
            .getOrDefault(ExifInterface.ORIENTATION_NORMAL)
        val matrix =
            Matrix().apply {
                when (orientation) {
                    ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f, 1f)
                    ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
                    ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f, -1f)
                    ExifInterface.ORIENTATION_TRANSPOSE -> {
                        setRotate(90f)
                        postScale(-1f, 1f)
                    }
                    ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
                    ExifInterface.ORIENTATION_TRANSVERSE -> {
                        setRotate(270f)
                        postScale(-1f, 1f)
                    }
                    ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(270f)
                }
            }
        return if (matrix.isIdentity) bitmap
        else Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    companion object {
        fun copyBounded(input: InputStream, target: File, limit: Long) {
            var count = 0L
            val buffer = ByteArray(65536)
            target.outputStream().use { out ->
                while (true) {
                    if (Thread.currentThread().isInterrupted) throw java.io.InterruptedIOException()
                    val read = input.read(buffer)
                    if (read < 0) break
                    count += read
                    require(count <= limit) { "Arquivo acima do limite permitido." }
                    out.write(buffer, 0, read)
                }
            }
            require(count > 0) { "O arquivo está vazio." }
        }
    }
}
