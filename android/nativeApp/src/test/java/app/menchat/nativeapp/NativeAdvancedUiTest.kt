package app.menchat.nativeapp

import android.Manifest
import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowDialog
import org.robolectric.util.ReflectionHelpers

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w320dp-h760dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class NativeAdvancedUiTest {
    @get:Rule val ui = createAndroidComposeRule<ComponentActivity>()
    private val actor = "10000000-0000-4000-8000-000000000001"
    private val account = Account(actor, "Pessoa", "AB123C", "Disponível", admin = true)

    private fun shot(name: String) {
        ui.waitForIdle()
        ui.runOnIdle {
            val view = ShadowDialog.getLatestDialog().window!!.decorView
            val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            view.draw(Canvas(bitmap))
            val file = File("/workspace/.menchat-tools/screenshots/$name.png")
            file.parentFile!!.mkdirs()
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }
    }

    @Test
    fun settingsSubmenusChangeAppearanceSoundAndDataControlsOnSmallPhone() {
        var state by mutableStateOf(NativeState(account = account))
        ui.setContent {
            MenChatTheme(state.options.theme != "light", state.options.textScale) {
                NativeSettings(
                    state,
                    "3.0.0",
                    { state = state.copy(options = it) },
                    {},
                    {},
                    {},
                    {},
                    {},
                )
            }
        }
        ui.onNodeWithText("Aparência").performClick()
        ui.onNodeWithText("Claro").performClick()
        assertEquals("light", state.options.theme)
        ui.onNodeWithText("Grande").performClick()
        assertEquals(1.15f, state.options.textScale)
        shot("appearance-small-phone")
        ui.onNodeWithContentDescription("Voltar das configurações").performClick()
        ui.onNodeWithText("Notificações").performScrollTo().performClick()
        ui.onNodeWithContentDescription("Som MenChat").performScrollTo().performClick()
        assertFalse(state.options.sound)
        ui.onNodeWithContentDescription("Vibrar").performScrollTo().performClick()
        assertFalse(state.options.vibration)
        shot("notifications-small-phone")
        ui.onNodeWithContentDescription("Voltar das configurações").performClick()
        ui.onNodeWithText("Dados e armazenamento").performScrollTo().performClick()
        ui.onNodeWithContentDescription("Economia de dados").performClick()
        assertFalse(state.options.auto("image"))
    }

    @Test
    @Config(qualifiers = "w390dp-h844dp-mdpi")
    fun groupAdminSeesRealParticipantActionsButCannotRemoveCreatorOrOwner() {
        val creator = Person("creator", "Ana Criadora", false, 0, 0, "admin")
        val owner = Person("owner", "Bruno Dono", false, 0, 0, "admin")
        val admin = Person(actor, "Carol Admin", false, 0, 0, "admin")
        val member = Person("member", "Davi Membro", false, 0, 0, "member")
        val state =
            NativeState(
                account = account,
                selected =
                    Conversation(
                        "group",
                        "Família",
                        true,
                        true,
                        "",
                        0,
                        creator = "creator",
                        owner = "owner",
                    ),
                people = listOf(creator, owner, admin, member),
            )
        var removal: String? = null
        ui.setContent {
            MenChatTheme(true) {
                NativeGroupDetails(
                    state,
                    { action, id, _, _ -> if (action == "remove") removal = id },
                    {},
                    {},
                )
            }
        }
        ui.onNodeWithText("Davi Membro").performScrollTo()
        ui.onAllNodesWithText("Remover", substring = false).assertCountEquals(1)
        shot("group-admin-phone")
        ui.onNodeWithText("Remover", substring = false).performScrollTo().performClick()
        ui.onNodeWithText("Remover Davi Membro?").assertIsDisplayed()
        ui.onNodeWithText("Confirmar").performClick()
        assertEquals("member", removal)
    }

    @Test
    fun cameraActionRequestsPermissionBeforeCreatingCaptureFile() {
        val context = RuntimeEnvironment.getApplication()
        shadowOf(context).denyPermissions(Manifest.permission.CAMERA)
        val model = MainModel(context)
        val mutable: MutableStateFlow<NativeState> = ReflectionHelpers.getField(model, "mutable")
        mutable.value =
            NativeState(
                account = account,
                selected = Conversation("thread", "Contato", false, true, "", 0),
            )
        model.foreground = true
        ui.setContent {
            val actions = rememberSelections(model)
            Button(onClick = { actions.camera(false, false) }) { Text("Capturar") }
        }
        ui.onNodeWithText("Capturar").performClick()
        ui.runOnIdle {
            val request = shadowOf(ui.activity).lastRequestedPermission
            assertNotNull(request)
            assertTrue(request.requestedPermissions.contains(Manifest.permission.CAMERA))
        }
        assertTrue(File(context.cacheDir, "menchat-capture").listFiles()?.isEmpty() != false)
    }

    @Test
    fun emojiPickerExposesNamedActionsAndReturnsSelectedEmoji() {
        var emoji = ""
        var closed = false
        ui.setContent {
            MenChatTheme(true) {
                NativeEmojiPicker({ emoji = it }, emptyList(), {}, {}, { closed = true })
            }
        }
        ui.onNodeWithText("Buscar emoji").performTextInput("sorriso")
        ui.onNodeWithContentDescription("Inserir Sorriso").performClick()
        assertEquals("😀", emoji)
        assertTrue(closed)
    }
}
