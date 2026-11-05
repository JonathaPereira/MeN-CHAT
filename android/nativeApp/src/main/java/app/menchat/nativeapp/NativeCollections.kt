package app.menchat.nativeapp

import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

@Composable
internal fun NativeInvitations(
    state: NativeState,
    create: (String) -> Unit,
    revoke: (String) -> Unit,
    close: () -> Unit,
) {
    val context = LocalContext.current
    val p = LocalChatPalette.current
    var email by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf<NativeInvitation?>(null) }
    Dialog(
        onDismissRequest = { if (!state.busy) close() },
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = p.canvas) {
            Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ChatIconButton(
                        Glyph.Back,
                        "Fechar convites",
                        enabled = !state.busy,
                        onClick = close,
                    )
                    Text("Convidar pessoas", style = MaterialTheme.typography.titleLarge)
                }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                Column(
                    Modifier.weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Text(
                        "Um convite por e-mail, de uso único e válido por 72 horas. O convidado confirma a posse do e-mail para ativar a conta.",
                        color = p.muted,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    OutlinedTextField(
                        email,
                        { if (it.length <= 254) email = it },
                        label = { Text("E-mail do convidado") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Button(
                        onClick = { create(email.trim()) },
                        enabled = !state.busy && email.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Gerar convite")
                    }
                    state.invitationUrl?.let { url ->
                        Text(
                            "Convite pronto para compartilhar. Ele não ativa a conta de outro e-mail.",
                            color = p.accent,
                        )
                        OutlinedButton(
                            onClick = {
                                context.startActivity(
                                    Intent.createChooser(
                                        Intent(Intent.ACTION_SEND)
                                            .setType("text/plain")
                                            .putExtra(Intent.EXTRA_TEXT, url),
                                        "Compartilhar convite",
                                    )
                                )
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("Compartilhar convite")
                        }
                    }
                    Text("Convites criados", style = MaterialTheme.typography.titleMedium)
                    state.invitations.forEach { invite ->
                        Surface(
                            color = p.panel,
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                        ) {
                            Column(Modifier.fillMaxWidth().padding(14.dp)) {
                                Text(invite.email)
                                Text(
                                    when (invite.state) {
                                        "pending" -> "Pendente"
                                        "used" -> "Usado"
                                        "revoked" -> "Revogado"
                                        else -> "Expirado"
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = p.muted,
                                )
                                if (invite.state == "pending")
                                    TextButton(
                                        onClick = { confirm = invite },
                                        enabled = !state.busy,
                                    ) {
                                        Text("Revogar convite")
                                    }
                            }
                        }
                    }
                }
            }
        }
        confirm?.let { invite ->
            AlertDialog(
                onDismissRequest = { confirm = null },
                title = { Text("Revogar convite?") },
                text = { Text(invite.email) },
                confirmButton = {
                    TextButton(
                        onClick = {
                            confirm = null
                            revoke(invite.id)
                        },
                        enabled = !state.busy,
                    ) {
                        Text("Revogar")
                    }
                },
                dismissButton = { TextButton(onClick = { confirm = null }) { Text("Cancelar") } },
            )
        }
    }
}

@Composable
internal fun NativeFavorites(
    state: NativeState,
    star: (Message) -> Unit,
    reply: (Message) -> Unit,
    media: @Composable (String) -> Unit,
    close: () -> Unit,
) {
    CollectionDialog("Mensagens favoritas", close) {
        if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (state.favorites.isEmpty() && !state.busy)
            Text(
                "Marque uma mensagem pela seta do balão para encontrá-la aqui.",
                color = LocalChatPalette.current.muted,
            )
        state.favorites.forEach { message ->
            Surface(
                color = LocalChatPalette.current.panel,
                shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (message.attachment != null) media(message.attachment)
                    if (message.text.isNotBlank()) Text(message.text)
                    Row {
                        TextButton(
                            onClick = {
                                reply(message)
                                close()
                            },
                            enabled = !state.busy && !state.retrySend,
                        ) {
                            Text("Responder")
                        }
                        TextButton(onClick = { star(message) }, enabled = !state.busy) {
                            Text("Desmarcar")
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun CollectionDialog(
    title: String,
    close: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    Dialog(
        onDismissRequest = close,
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = LocalChatPalette.current.canvas) {
            Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ChatIconButton(Glyph.Back, "Fechar $title", onClick = close)
                    Text(title, style = MaterialTheme.typography.titleLarge)
                }
                Column(
                    Modifier.weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    content = content,
                )
            }
        }
    }
}
