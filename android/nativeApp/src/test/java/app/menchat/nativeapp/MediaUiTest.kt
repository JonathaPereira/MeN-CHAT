package app.menchat.nativeapp

import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import java.io.File
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowDialog

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w320dp-h740dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MediaUiTest {
    @get:Rule val ui = createAndroidComposeRule<ComponentActivity>()
    private val account = Account("actor", "Jonatha Pereira", "JP7N42", "Disponível")

    private fun shot(name: String, dialog: Boolean = false) {
        ui.waitForIdle()
        ui.runOnIdle {
            val view =
                if (dialog) ShadowDialog.getLatestDialog().window!!.decorView
                else ui.activity.window.decorView
            val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            view.draw(Canvas(bitmap))
            val file = File("/tmp/menchat-android-ui/$name.png")
            file.parentFile!!.mkdirs()
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }
    }

    @Test
    fun smallPhoneKeepsInputWideWithAccessibleClipCameraAndMicrophoneOnTheRight() {
        var state by
            mutableStateOf(
                NativeState(
                    account = account,
                    selected = Conversation("thread", "Ana", false, true, "", 0),
                )
            )
        var attached = false
        var camera = false
        var recorded = false
        ui.setContent {
            MenChatTheme(true) {
                Column(Modifier.fillMaxSize()) {
                    Spacer(Modifier.weight(1f))
                    ComposerContent(
                        state,
                        { state = state.copy(text = it) },
                        {},
                        { recorded = true },
                        {},
                        {},
                        {},
                        {},
                        attach = { attached = true },
                        camera = { camera = true },
                    )
                }
            }
        }
        val input = ui.onNodeWithContentDescription("Mensagem").fetchSemanticsNode().boundsInRoot
        val mic = ui.onNodeWithContentDescription("Gravar áudio").fetchSemanticsNode().boundsInRoot
        val clip =
            ui.onNodeWithContentDescription("Anexar arquivo").fetchSemanticsNode().boundsInRoot
        assertTrue("text area $input", input.width >= 250f)
        assertTrue("mic $mic below $input", mic.top >= input.bottom)
        assertTrue("mic $mic right of $clip", mic.left > clip.right)
        ui.onNodeWithContentDescription("Anexar arquivo").performClick()
        ui.onNodeWithContentDescription("Abrir câmera").performClick()
        ui.onNodeWithContentDescription("Gravar áudio").performClick()
        assertTrue(attached)
        assertTrue(camera)
        assertTrue(recorded)
        shot("media-toolbar-small-phone")
    }

    @Test
    fun fileDraftHasRemovalPreviewAndRealSendAction() {
        val file = File.createTempFile("draft-ui", ".pdf").apply { writeText("fixture") }
        try {
            var state by
                mutableStateOf(
                    NativeState(
                        account = account,
                        selected = Conversation("thread", "Ana", false, true, "", 0),
                        attachment =
                            LocalAttachment(file, "arquivo.pdf", "application/pdf", "document"),
                    )
                )
            var sent = false
            var preview = false
            ui.setContent {
                MenChatTheme(true) {
                    Surface {
                        ComposerContent(
                            state,
                            {},
                            {},
                            {},
                            {},
                            {},
                            { sent = true },
                            {},
                            attach = {},
                            camera = {},
                            discardMedia = { state = state.copy(attachment = null) },
                            preview = { preview = true },
                        )
                    }
                }
            }
            ui.onNodeWithContentDescription("Gravar áudio").assertIsNotEnabled()
            ui.onNodeWithText("arquivo.pdf").performClick()
            assertTrue(preview)
            ui.onNodeWithContentDescription("Enviar mensagem").performClick()
            assertTrue(sent)
            ui.onNodeWithContentDescription("Remover anexo").performClick()
            ui.onNodeWithText("arquivo.pdf").assertDoesNotExist()
        } finally {
            file.delete()
        }
    }

    @Test
    fun uncertainSendLocksPayloadButKeepsRetryAvailable() {
        val state =
            NativeState(
                account = account,
                selected = Conversation("thread", "Ana", false, true, "", 0),
                text = "Legenda original",
                retrySend = true,
            )
        var retry = false
        var discarded = false
        ui.setContent {
            MenChatTheme(true) {
                Surface {
                    ComposerContent(
                        state,
                        { fail("Editing must be frozen") },
                        {},
                        {},
                        {},
                        {},
                        { retry = true },
                        {},
                        attach = {},
                        camera = {},
                        discardMedia = { discarded = true },
                    )
                }
            }
        }
        ui.onNodeWithContentDescription("Mensagem").assertIsNotEnabled()
        ui.onNodeWithContentDescription("Anexar arquivo").assertIsNotEnabled()
        ui.onNodeWithContentDescription("Tentar enviar novamente").performClick()
        assertTrue(retry)
        ui.onNodeWithContentDescription("Descartar tentativa de envio").performClick()
        assertTrue(discarded)
    }

    @Test
    @Config(qualifiers = "w390dp-h844dp-mdpi")
    fun profileEditorUpdatesFieldsAndPrivacyAndExposesPhotoActions() {
        var draft by
            mutableStateOf(ProfileDraft(account.name, account.status, true, true, true, true))
        var saved = false
        var gallery = false
        var camera = false
        ui.setContent {
            MenChatTheme(true) {
                ProfileEditor(
                    account,
                    draft,
                    false,
                    { draft = it },
                    { gallery = true },
                    { camera = true },
                    {},
                    { saved = true },
                    {},
                )
            }
        }
        ui.onNodeWithText("Nome").performTextReplacement("Nome atualizado")
        ui.onNodeWithContentDescription("Mostrar meu código").performScrollTo().performClick()
        assertFalse(draft.showCode)
        ui.onNodeWithText("Galeria").performScrollTo().performClick()
        ui.onNodeWithText("Câmera").performClick()
        assertTrue(gallery)
        assertTrue(camera)
        ui.onNodeWithText("Salvar").performClick()
        assertTrue(saved)
        assertEquals("Nome atualizado", draft.name)
        shot("profile-dark-phone", true)
    }

    @Test
    fun imageViewerOpensAndClosesWithoutLaunchingBrowser() {
        val file = File.createTempFile("photo-ui", ".png")
        val bitmap = Bitmap.createBitmap(100, 100, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.GREEN)
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
        try {
            var open by mutableStateOf(true)
            ui.setContent {
                MenChatTheme(true) {
                    if (open)
                        MediaPreview(
                            "image",
                            "foto.jpg",
                            { file.toURI().toString() },
                            { open = false },
                        )
                }
            }
            ui.onNodeWithContentDescription("Fechar visualização")
                .assertIsDisplayed()
                .performClick()
            ui.onNodeWithContentDescription("Fechar visualização").assertDoesNotExist()
        } finally {
            file.delete()
        }
    }
}
