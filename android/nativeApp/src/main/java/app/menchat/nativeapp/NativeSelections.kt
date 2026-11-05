package app.menchat.nativeapp

import android.Manifest
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID

internal class CaptureVideoContract : ActivityResultContracts.CaptureVideo() {
    override fun createIntent(context: Context, input: Uri): Intent =
        super.createIntent(context, input).apply {
            putExtra(MediaStore.EXTRA_DURATION_LIMIT, 120)
            putExtra(MediaStore.EXTRA_SIZE_LIMIT, 25_000_000L)
            putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 1)
            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            clipData = ClipData.newRawUri("captura", input)
        }
}

internal class CapturePhotoContract : ActivityResultContracts.TakePicture() {
    override fun createIntent(context: Context, input: Uri): Intent =
        super.createIntent(context, input).apply {
            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            clipData = ClipData.newRawUri("captura", input)
        }
}

internal object CaptureFiles {
    fun create(context: Context, video: Boolean): File =
        File(
            File(context.cacheDir, "menchat-capture").apply { mkdirs() },
            "${UUID.randomUUID()}.${if(video)"mp4" else "jpg"}",
        )

    fun restore(context: Context, path: String): File? {
        if (path.isBlank()) return null
        val file = File(path)
        return file.takeIf {
            it.canonicalFile.parentFile ==
                File(context.cacheDir, "menchat-capture").canonicalFile &&
                Regex("[a-f0-9-]{36}\\.(jpg|mp4)").matches(it.name)
        }
    }

    fun uri(context: Context, file: File): Uri =
        FileProvider.getUriForFile(context, context.packageName + ".capture", file)
}

internal data class SelectionActions(
    val gallery: (Boolean) -> Unit,
    val document: (Boolean) -> Unit,
    val camera: (Boolean, Boolean) -> Unit,
    val sticker: () -> Unit,
)

@Composable
internal fun rememberSelections(model: MainModel): SelectionActions {
    val context = LocalContext.current
    var actor by rememberSaveable { mutableStateOf("") }
    var thread by rememberSaveable { mutableStateOf<String?>(null) }
    var profile by rememberSaveable { mutableStateOf(false) }
    var path by rememberSaveable { mutableStateOf("") }
    var inFlight by rememberSaveable { mutableStateOf(false) }
    SideEffect { model.pickerCovered = inFlight }
    DisposableEffect(model) { onDispose { model.pickerCovered = false } }
    fun returned(uri: Uri?) {
        inFlight = false
        if (uri != null) model.receiveSelection(uri, actor, thread, profile)
    }
    fun captured(ok: Boolean, video: Boolean) {
        inFlight = false
        val file = CaptureFiles.restore(context, path)
        path = ""
        file?.let {
            context.revokeUriPermission(
                CaptureFiles.uri(context, it),
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
            )
            if (ok) model.receiveSelection(null, actor, thread, profile, it, video) else it.delete()
        }
    }
    var stickerActor by rememberSaveable { mutableStateOf("") }
    val stickerGallery =
        rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            inFlight = false
            if (uri != null) model.importSticker(uri, stickerActor)
        }
    val gallery =
        rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) {
            returned(it)
        }
    val documents =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { returned(it) }
    val photo = rememberLauncherForActivityResult(CapturePhotoContract()) { captured(it, false) }
    val video = rememberLauncherForActivityResult(CaptureVideoContract()) { captured(it, true) }
    fun prepare(forProfile: Boolean): Boolean {
        val state = model.state.value
        if (inFlight || state.busy || state.recording || state.retrySend) return false
        val account = state.account ?: return false
        if (!forProfile && (state.selected?.canSend != true || state.voice != null)) return false
        actor = account.id
        thread = if (forProfile) null else state.selected?.id
        profile = forProfile
        inFlight = true
        return true
    }
    fun failed() {
        inFlight = false
        CaptureFiles.restore(context, path)?.delete()
        path = ""
        model.error("Não foi possível abrir o seletor ou a câmera deste aparelho.")
    }
    var captureVideo by rememberSaveable { mutableStateOf(false) }
    fun launchCapture() {
        val current = model.state.value
        if (
            current.account?.id != actor ||
                current.busy ||
                current.callActive ||
                (!profile && current.selected?.id != thread)
        ) {
            inFlight = false
            return
        }
        try {
            val file = CaptureFiles.create(context, captureVideo)
            path = file.absolutePath
            val uri = CaptureFiles.uri(context, file)
            if (captureVideo) video.launch(uri) else photo.launch(uri)
        } catch (_: Exception) {
            failed()
        }
    }
    val cameraPermission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) launchCapture()
            else {
                inFlight = false
                model.error(
                    "Permita a câmera nas configurações do Android para capturar fotos e vídeos."
                )
            }
        }
    return SelectionActions(
        sticker = {
            val state = model.state.value
            if (!inFlight && !state.busy && state.account != null) {
                stickerActor = state.account.id
                inFlight = true
                try {
                    stickerGallery.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                    )
                } catch (_: Exception) {
                    failed()
                }
            }
        },
        gallery = { forProfile ->
            if (prepare(forProfile))
                try {
                    gallery.launch(
                        PickVisualMediaRequest(
                            if (forProfile) ActivityResultContracts.PickVisualMedia.ImageOnly
                            else ActivityResultContracts.PickVisualMedia.ImageAndVideo
                        )
                    )
                } catch (_: Exception) {
                    failed()
                }
        },
        document = { audio ->
            if (prepare(false))
                try {
                    documents.launch(
                        if (audio) arrayOf("audio/*")
                        else
                            arrayOf(
                                "application/pdf",
                                "text/plain",
                                "application/zip",
                                "application/x-zip-compressed",
                                "application/msword",
                                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                "application/vnd.ms-excel",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            )
                    )
                } catch (_: Exception) {
                    failed()
                }
        },
        camera = { isVideo, forProfile ->
            if (model.state.value.callActive)
                model.error("Encerre a chamada antes de usar a câmera para um anexo.")
            else if (prepare(forProfile)) {
                captureVideo = isVideo
                if (
                    context.checkSelfPermission(Manifest.permission.CAMERA) ==
                        PackageManager.PERMISSION_GRANTED
                )
                    launchCapture()
                else cameraPermission.launch(Manifest.permission.CAMERA)
            }
        },
    )
}
