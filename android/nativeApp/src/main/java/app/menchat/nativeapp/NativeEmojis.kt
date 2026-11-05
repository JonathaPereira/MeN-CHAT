package app.menchat.nativeapp

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

internal val nativeEmojis =
    listOf(
        "😀" to "Sorriso",
        "😂" to "Rindo",
        "🥹" to "Emocionado",
        "😍" to "Apaixonado",
        "🥰" to "Carinho",
        "😘" to "Beijo",
        "😎" to "Estiloso",
        "🤔" to "Pensando",
        "😭" to "Chorando",
        "😴" to "Sono",
        "😡" to "Bravo",
        "🤯" to "Surpreso",
        "🥳" to "Festa",
        "😅" to "Aliviado",
        "🙃" to "De cabeça para baixo",
        "🤗" to "Abraço",
        "👍" to "Legal",
        "👎" to "Não gostei",
        "👏" to "Palmas",
        "🙌" to "Comemorar",
        "🙏" to "Obrigado",
        "👋" to "Olá",
        "🤝" to "Acordo",
        "💪" to "Força",
        "❤️" to "Coração",
        "💚" to "Coração verde",
        "💜" to "Coração roxo",
        "💔" to "Coração partido",
        "💕" to "Amor",
        "✨" to "Brilho",
        "🔥" to "Fogo",
        "💯" to "Cem pontos",
        "☀️" to "Sol",
        "🌙" to "Lua",
        "🌧️" to "Chuva",
        "🌻" to "Flor",
        "🐶" to "Cachorro",
        "🐱" to "Gato",
        "🍕" to "Pizza",
        "🍿" to "Pipoca",
        "☕" to "Café",
        "🎂" to "Bolo",
        "🎉" to "Confete",
        "🎁" to "Presente",
        "🎮" to "Jogo",
        "🎵" to "Música",
        "⚽" to "Futebol",
        "✅" to "Confirmado",
    )

@Composable
internal fun NativeEmojiPicker(
    emoji: (String) -> Unit,
    mentions: List<Person>,
    mention: (Person) -> Unit,
    stickers: () -> Unit,
    close: () -> Unit,
) {
    var search by remember { mutableStateOf("") }
    CollectionDialog("Emojis", close) {
        OutlinedTextField(
            search,
            { search = it },
            label = { Text("Buscar emoji") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        FlowRow {
            nativeEmojis
                .filter { it.second.contains(search, true) || it.first == search }
                .forEach { (symbol, label) ->
                    TextButton(
                        onClick = {
                            emoji(symbol)
                            close()
                        },
                        modifier =
                            Modifier.size(52.dp).semantics {
                                contentDescription = "Inserir $label"
                            },
                    ) {
                        Text(
                            symbol,
                            modifier = Modifier,
                            style = MaterialTheme.typography.headlineSmall,
                        )
                    }
                }
        }
        OutlinedButton(onClick = stickers, modifier = Modifier.fillMaxWidth()) {
            ChatIcon(Glyph.Sticker)
            Spacer(Modifier.width(8.dp))
            Text("Minhas figurinhas")
        }
        if (mentions.isNotEmpty()) {
            Text("Mencionar participante", style = MaterialTheme.typography.titleMedium)
            mentions.forEach { person ->
                SettingsEntry(Glyph.Mention, person.name) {
                    mention(person)
                    close()
                }
            }
        }
    }
}
