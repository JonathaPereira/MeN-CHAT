package app.menchat.nativeapp

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.MediaStore
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayInputStream
import java.io.File
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.util.ReflectionHelpers

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LocalMediaTest {
    // Robolectric changes the app data directory per test; FileProvider caches it statically.
    @Before
    fun resetProviderRootCache() {
        ReflectionHelpers.getStaticField<MutableMap<String, Any>>(
                FileProvider::class.java,
                "sCache",
            )
            .clear()
    }

    private val context
        get() = RuntimeEnvironment.getApplication()

    private fun photo(): File =
        CaptureFiles.create(context, false).also { file ->
            val bitmap = Bitmap.createBitmap(900, 600, Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(android.graphics.Color.GREEN)
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it) }
            bitmap.recycle()
            ExifInterface(file).apply {
                setAttribute(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_ROTATE_90.toString(),
                )
                setAttribute(ExifInterface.TAG_GPS_LATITUDE, "23/1,1/1,1/1")
                saveAttributes()
            }
        }

    @Test
    fun allowedTypesHaveExactlyTheServerLimitsAndRejectUnsafeFiles() {
        NativeMediaPolicy.types.forEach { (mime, kind) ->
            assertEquals(
                kind,
                NativeMediaPolicy.check("anexo", mime, NativeMediaPolicy.limit(kind)),
            )
            assertThrows(IllegalArgumentException::class.java) {
                NativeMediaPolicy.check("anexo", mime, NativeMediaPolicy.limit(kind) + 1)
            }
        }
        for (name in listOf("virus.EXE", "teste.html", "foto.svg", "", "foto\n.jpg")) assertThrows(
            IllegalArgumentException::class.java
        ) {
            NativeMediaPolicy.check(name, "image/jpeg", 12)
        }
        assertThrows(IllegalStateException::class.java) {
            NativeMediaPolicy.check("app.apk", "application/vnd.android.package-archive", 12)
        }
        assertThrows(IllegalArgumentException::class.java) {
            NativeMediaPolicy.check("vazio.pdf", "application/pdf", 0)
        }
    }

    @Test
    fun boundedCopyRejectsOverLimitWithoutWritingExcessData() {
        val file = File.createTempFile("bounded", ".tmp", context.cacheDir)
        try {
            assertThrows(IllegalArgumentException::class.java) {
                NativeLocalMedia.copyBounded(ByteArrayInputStream(ByteArray(200)), file, 100)
            }
            assertTrue(file.length() <= 100)
            assertThrows(IllegalArgumentException::class.java) {
                NativeLocalMedia.copyBounded(ByteArrayInputStream(byteArrayOf()), file, 100)
            }
            NativeLocalMedia.copyBounded(ByteArrayInputStream(byteArrayOf(1, 2, 3)), file, 3)
            assertArrayEquals(byteArrayOf(1, 2, 3), file.readBytes())
        } finally {
            file.delete()
        }
    }

    @Test
    fun profilePhotoIsSquareSmallAndHasNoLocationMetadata() {
        val original = photo()
        val item = NativeLocalMedia(context).import(CaptureFiles.uri(context, original), true)
        try {
            assertEquals("avatar", item.kind)
            assertEquals("image/webp", item.mime)
            assertTrue(item.bytes in 1..200000)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(item.file.path, bounds)
            assertEquals(256, bounds.outWidth)
            assertEquals(256, bounds.outHeight)
            assertNull(ExifInterface(item.file).getAttribute(ExifInterface.TAG_GPS_LATITUDE))
        } finally {
            original.delete()
            item.file.delete()
        }
    }

    @Test
    fun capturedPhotoAppliesOrientationAndRemovesMetadata() {
        val original = photo()
        val item = NativeLocalMedia(context).captured(original, false, false)
        try {
            val bitmap = BitmapFactory.decodeFile(item.file.path)
            assertEquals(600, bitmap.width)
            assertEquals(900, bitmap.height)
            bitmap.recycle()
            assertNull(ExifInterface(item.file).getAttribute(ExifInterface.TAG_GPS_LATITUDE))
            assertTrue(item.bytes <= 5_000_000)
        } finally {
            original.delete()
            item.file.delete()
        }
    }

    @Test
    fun importRejectsFileUrlsAndEmptyOrOversizedProfilePhoto() {
        val local = NativeLocalMedia(context)
        assertThrows(IllegalArgumentException::class.java) {
            local.import(Uri.parse("file:///etc/passwd"))
        }
        val file = CaptureFiles.create(context, false)
        try {
            file.writeBytes(ByteArray(2_000_001))
            assertThrows(IllegalArgumentException::class.java) {
                local.import(CaptureFiles.uri(context, file), true)
            }
            file.writeBytes(byteArrayOf())
            assertThrows(IllegalArgumentException::class.java) {
                local.captured(file, false, false)
            }
        } finally {
            file.delete()
        }
    }

    @Test
    fun captureContractsGrantOnlyTheSelectedUriAndConstrainVideo() {
        val file = CaptureFiles.create(context, true)
        val uri = CaptureFiles.uri(context, file)
        for (contract in listOf(CaptureVideoContract(), CapturePhotoContract())) {
            val intent = contract.createIntent(context, uri)
            assertEquals(uri, intent.clipData!!.getItemAt(0).uri)
            assertEquals(uri, intent.getParcelableExtra(MediaStore.EXTRA_OUTPUT, Uri::class.java))
            assertTrue(intent.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION != 0)
        }
        val intent = CaptureVideoContract().createIntent(context, uri)
        assertEquals(120, intent.getIntExtra(MediaStore.EXTRA_DURATION_LIMIT, 0))
        assertEquals(25_000_000, intent.getLongExtra(MediaStore.EXTRA_SIZE_LIMIT, 0))
        assertNull(CaptureFiles.restore(context, "/data/private/session"))
        assertEquals(file, CaptureFiles.restore(context, file.path))
        assertThrows(IllegalArgumentException::class.java) {
            CaptureFiles.uri(context, File(context.filesDir, "secret"))
        }
        val info =
            context.packageManager.resolveContentProvider(context.packageName + ".capture", 0)!!
        assertFalse(info.exported)
        assertTrue(info.grantUriPermissions)
    }
}
