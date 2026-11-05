package app.menchat.nativeapp

import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import java.io.File
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class NativeUiTest {
    @get:Rule val ui = createAndroidComposeRule<ComponentActivity>()
    private val me = "10000000-0000-4000-8000-000000000001"
    private val friend = "10000000-0000-4000-8000-000000000002"
    private val ana =
        Conversation(
            "20000000-0000-4000-8000-000000000001",
            "Ana Oliveira",
            false,
            true,
            "Te encontro às 20h?",
            3,
            "2026-11-04T19:42:00Z",
        )
    private val family =
        Conversation(
            "20000000-0000-4000-8000-000000000002",
            "Família reunida",
            true,
            true,
            "Domingo tem almoço por aqui!",
            0,
        )

    private fun seed(selected: Boolean = true) =
        NativeState(
                account = Account(me, "Jonatha Pereira", "JP7N42", "Disponível para conversar"),
                threads =
                    listOf(
                        ana,
                        family,
                        Conversation(
                            "20000000-0000-4000-8000-000000000003",
                            "Lucas Santos",
                            false,
                            true,
                            "Valeu pela dica!",
                            0,
                        ),
                    ),
                selected = if (selected) ana else null,
                messages =
                    listOf(
                        Message(
                            "30000000-0000-4000-8000-000000000001",
                            1,
                            friend,
                            "Te encontro às 20h?",
                            "2026-11-04T19:42:00Z",
                            null,
                            false,
                            null,
                        ),
                        Message(
                            "30000000-0000-4000-8000-000000000002",
                            2,
                            me,
                            "Combinado! Vou levar o controle para a gente jogar.",
                            "2026-11-04T19:43:00Z",
                            null,
                            false,
                            null,
                        ),
                        Message(
                            "30000000-0000-4000-8000-000000000003",
                            3,
                            friend,
                            "Perfeito, até mais tarde!",
                            "2026-11-04T19:44:00Z",
                            null,
                            false,
                            null,
                        ),
                    ),
                people =
                    listOf(
                        Person(me, "Jonatha", false, 3, 3),
                        Person(friend, "Ana Oliveira", false, 3, 3),
                    ),
            )
            .let {
                it.copy(
                    messages =
                        it.messages +
                            Message(
                                "30000000-0000-4000-8000-000000000004",
                                4,
                                me,
                                "",
                                "2026-11-04T19:45:00Z",
                                "40000000-0000-4000-8000-000000000001",
                                false,
                                null,
                            )
                )
            }

    private fun shot(name: String) {
        val file = File("/tmp/menchat-android-ui/$name.png")
        file.parentFile!!.mkdirs()
        ui.waitForIdle()
        ui.runOnIdle {
            val view = ui.activity.window.decorView
            val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            view.draw(Canvas(bitmap))
            file.outputStream().use { output ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
            }
            bitmap.recycle()
        }
    }

    @Composable
    private fun Screen(
        value: NativeState,
        update: (NativeState) -> Unit,
        dark: Boolean = true,
        theme: () -> Unit = {},
    ) {
        var menu by remember { mutableStateOf<Message?>(null) }
        MenChatTheme(dark) {
            Surface(Modifier.fillMaxSize()) {
                AdaptiveChatWorkspace(
                    value,
                    dark,
                    { update(value.copy(selected = it)) },
                    {},
                    {},
                    {},
                    theme,
                ) {
                    ConversationPane(
                        value,
                        { update(value.copy(selected = null)) },
                        {},
                        { update(value.copy(reply = it)) },
                        { _, _ -> },
                        {},
                        {},
                        menu,
                        { menu = it },
                        composer = {
                            ComposerContent(
                                value,
                                { update(value.copy(text = it)) },
                                { update(value.copy(reply = null)) },
                                { update(value.copy(recording = true, seconds = 12)) },
                                { update(value.copy(recording = false)) },
                                {},
                                { update(value.copy(text = "")) },
                                { update(value.copy(recording = false)) },
                                attach = {},
                                camera = {},
                            )
                        },
                        media = { id ->
                            AudioTransport(
                                AudioState(id = id, duration = 34000, elapsed = 13000),
                                id,
                                {},
                                {},
                                {},
                            )
                        },
                    )
                }
            }
        }
    }

    @Test
    fun phoneInboxSearchAndFiltersUseExistingConversations() {
        var state by mutableStateOf(seed(false))
        ui.setContent { Screen(state, { state = it }) }
        ui.onNodeWithText("Ana Oliveira").assertIsDisplayed()
        ui.onNodeWithText("Não lidas").performClick()
        ui.onNodeWithText("Família reunida").assertDoesNotExist()
        ui.onNodeWithText("Todas").performClick()
        ui.onNodeWithContentDescription("Buscar conversa").performTextInput("Lucas")
        ui.onNodeWithText("Lucas Santos").assertIsDisplayed()
        ui.onNodeWithText("Ana Oliveira").assertDoesNotExist()
        ui.onNodeWithContentDescription("Limpar busca").performClick()
        shot("inbox-dark-phone")
        ui.onNodeWithText("Ana Oliveira").performClick()
        ui.onNodeWithContentDescription("Conversa Ana Oliveira").assertIsDisplayed()
    }

    @Test
    fun phoneMenuReplyAndRecordingPreserveConversationLayout() {
        var state by mutableStateOf(seed())
        ui.setContent { Screen(state, { state = it }) }
        val anchor = ui.onNodeWithText("Perfeito, até mais tarde!")
        val before = anchor.fetchSemanticsNode().boundsInRoot
        shot("chat-dark-phone")
        ui.onAllNodesWithContentDescription("Opções da mensagem").onFirst().performClick()
        assertEquals(before, anchor.fetchSemanticsNode().boundsInRoot)
        ui.onNodeWithText("Responder").performClick()
        ui.onNodeWithText("Respondendo").assertIsDisplayed()
        ui.onNodeWithContentDescription("Cancelar resposta").performClick()
        val input = ui.onNodeWithContentDescription("Mensagem").fetchSemanticsNode().boundsInRoot
        val mic = ui.onNodeWithContentDescription("Gravar áudio").fetchSemanticsNode().boundsInRoot
        assertTrue(mic.right > input.right - 70f)
        assertTrue(mic.top >= input.bottom)
        ui.onNodeWithContentDescription("Gravar áudio").performClick()
        ui.onNodeWithText("Gravando áudio").assertIsDisplayed()
        ui.onNodeWithContentDescription("Enviar áudio").performClick()
        ui.onNodeWithContentDescription("Mensagem").performTextInput("Boa noite")
        ui.onNodeWithContentDescription("Enviar mensagem").performClick()
        ui.runOnIdle { assertEquals("", state.text) }
    }

    @Test
    @Config(qualifiers = "w1000dp-h800dp-mdpi")
    fun wideScreenShowsListAndConversationTogether() {
        var state by mutableStateOf(seed())
        ui.setContent { Screen(state, { state = it }) }
        ui.onNodeWithContentDescription("Lista de conversas").assertIsDisplayed()
        ui.onNodeWithContentDescription("Conversa Ana Oliveira").assertIsDisplayed()
        shot("chat-dark-tablet")
        ui.onNodeWithText("Família reunida").performClick()
        ui.onNodeWithContentDescription("Conversa Família reunida").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "w320dp-h640dp-mdpi")
    fun largeFontOnSmallPhoneKeepsComposerInsideScreen() {
        var state by mutableStateOf(seed())
        ui.setContent {
            CompositionLocalProvider(LocalDensity provides Density(1f, 1.6f)) {
                Screen(state, { state = it }, false)
            }
        }
        val root = ui.onRoot().fetchSemanticsNode().boundsInRoot
        val input = ui.onNodeWithContentDescription("Mensagem").fetchSemanticsNode().boundsInRoot
        val send =
            ui.onNodeWithContentDescription("Enviar mensagem").fetchSemanticsNode().boundsInRoot
        assertTrue(input.width > 80f)
        assertTrue(send.right <= root.right && send.bottom <= root.bottom)
        shot("chat-light-small-large-font")
    }

    @Test
    fun loginIsNativeAndSubmitsOnlyEnteredCredentials() {
        var submitted: Pair<String, String>? = null
        ui.setContent {
            MenChatTheme(false) {
                Surface(Modifier.fillMaxSize()) {
                    NativeLogin(false) { email, password -> submitted = email to password }
                }
            }
        }
        ui.onNode(hasSetTextAction() and hasText("E-mail")).performTextInput("fixture@example.test")
        ui.onNode(hasSetTextAction() and hasText("Senha")).performTextInput("fixture-password")
        shot("login-light-phone")
        ui.onNodeWithText("Entrar").performClick()
        ui.runOnIdle { assertEquals("fixture@example.test" to "fixture-password", submitted) }
    }

    @Test
    fun recordingWithReplyDoesNotRequestFocusOnMissingInput() {
        var state by
            mutableStateOf(
                seed().let { it.copy(recording = true, seconds = 12, reply = it.messages.first()) }
            )
        ui.setContent { Screen(state, { state = it }) }
        ui.onNodeWithText("Gravando áudio").assertIsDisplayed()
        ui.onNodeWithContentDescription("Descartar áudio").performClick()
        ui.onNodeWithContentDescription("Mensagem").assertIsDisplayed()
    }

    @Test
    fun appearanceControlSwitchesThemeWithoutLeavingInbox() {
        var state by mutableStateOf(seed(false))
        var dark by mutableStateOf(true)
        ui.setContent { Screen(state, { state = it }, dark, { dark = !dark }) }
        ui.onNodeWithContentDescription("Ativar modo claro").performClick()
        ui.runOnIdle { assertFalse(dark) }
        ui.onNodeWithContentDescription("Ativar modo escuro").assertIsDisplayed()
        ui.onNodeWithText("Ana Oliveira").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "w840dp-h390dp-mdpi")
    fun landscapeKeepsBothPanesAndComposerVisible() {
        var state by mutableStateOf(seed())
        ui.setContent { Screen(state, { state = it }) }
        ui.onNodeWithContentDescription("Lista de conversas").assertIsDisplayed()
        ui.onNodeWithContentDescription("Mensagem").assertIsDisplayed()
        val root = ui.onRoot().fetchSemanticsNode().boundsInRoot
        val button =
            ui.onNodeWithContentDescription("Gravar áudio").fetchSemanticsNode().boundsInRoot
        assertTrue(button.bottom <= root.bottom)
        shot("chat-dark-landscape")
    }
}
