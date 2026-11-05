package app.menchat.nativeapp

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest

@Composable
internal fun ProfileEditor(
    account: Account,
    draft: ProfileDraft,
    busy: Boolean,
    edit: (ProfileDraft) -> Unit,
    gallery: () -> Unit,
    camera: () -> Unit,
    remove: () -> Unit,
    save: () -> Unit,
    close: () -> Unit,
) {
    val p = LocalChatPalette.current
    Dialog(
        onDismissRequest = { if (!busy) close() },
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = p.canvas) {
            Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                Row(
                    Modifier.fillMaxWidth().padding(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ChatIconButton(Glyph.Back, "Voltar do perfil", enabled = !busy, onClick = close)
                    Text(
                        "Editar perfil",
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.titleLarge,
                    )
                    TextButton(onClick = save, enabled = !busy && draft.name.trim().isNotEmpty()) {
                        Text("Salvar")
                    }
                }
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                Column(
                    Modifier.weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp, vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    val photo = draft.photo
                    if (photo != null)
                        AsyncImage(
                            model =
                                ImageRequest.Builder(LocalContext.current)
                                    .data(photo.file)
                                    .diskCachePolicy(CachePolicy.DISABLED)
                                    .build(),
                            contentDescription = "Prévia da foto de perfil",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.size(96.dp).clip(CircleShape),
                        )
                    else
                        ChatAvatar(
                            draft.name,
                            false,
                            96,
                            if (draft.removePhoto) null else account.avatarPath,
                        )
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = gallery, enabled = !busy) {
                            ChatIcon(Glyph.Photo)
                            Spacer(Modifier.width(8.dp))
                            Text("Galeria")
                        }
                        OutlinedButton(onClick = camera, enabled = !busy) {
                            ChatIcon(Glyph.Camera)
                            Spacer(Modifier.width(8.dp))
                            Text("Câmera")
                        }
                    }
                    if (photo != null || (account.avatarPath != null && !draft.removePhoto))
                        TextButton(onClick = remove, enabled = !busy) { Text("Remover foto") }
                    Text(
                        "JPG, PNG ou WebP até 2 MB. Recorte central automático.",
                        style = MaterialTheme.typography.bodySmall,
                        color = p.muted,
                    )
                    OutlinedTextField(
                        value = draft.name,
                        onValueChange = { if (it.length <= 50) edit(draft.copy(name = it)) },
                        label = { Text("Nome") },
                        supportingText = { Text("${draft.name.length}/50") },
                        singleLine = true,
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                    )
                    OutlinedTextField(
                        value = draft.status,
                        onValueChange = { if (it.length <= 140) edit(draft.copy(status = it)) },
                        label = { Text("Status") },
                        supportingText = { Text("${draft.status.length}/140") },
                        maxLines = 3,
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                    )
                    Text(
                        "Privacidade",
                        Modifier.align(Alignment.Start),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    ProfileSwitch(
                        "Mostrar meu código",
                        "Exibir no meu perfil",
                        draft.showCode,
                        busy,
                    ) {
                        edit(draft.copy(showCode = it))
                    }
                    ProfileSwitch(
                        "Permitir busca por código",
                        "Outros membros podem iniciar uma conversa",
                        draft.lookup,
                        busy,
                    ) {
                        edit(draft.copy(lookup = it))
                    }
                    ProfileSwitch(
                        "Confirmações de leitura",
                        "Compartilhar quando você leu",
                        draft.readReceipts,
                        busy,
                    ) {
                        edit(draft.copy(readReceipts = it))
                    }
                    ProfileSwitch(
                        "Mostrar digitação",
                        "Compartilhar quando você está digitando",
                        draft.showTyping,
                        busy,
                    ) {
                        edit(draft.copy(showTyping = it))
                    }
                    Text(
                        "Estas preferências também valem na versão web.",
                        style = MaterialTheme.typography.bodySmall,
                        color = p.muted,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileSwitch(
    title: String,
    detail: String,
    checked: Boolean,
    busy: Boolean,
    change: (Boolean) -> Unit,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, style = MaterialTheme.typography.bodyMedium)
            Text(
                detail,
                style = MaterialTheme.typography.bodySmall,
                color = LocalChatPalette.current.muted,
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = change,
            enabled = !busy,
            modifier = Modifier.semantics { contentDescription = title },
        )
    }
}
