package app.menchat.nativeapp

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun ConversationPane(
    state: NativeState,
    onBack: () -> Unit,
    onSettings: () -> Unit,
    onReply: (Message?) -> Unit,
    onDelete: (Message, Boolean) -> Unit,
    onHistory: () -> Unit,
    onAtBottom: (Boolean) -> Unit,
    menuMessage: Message?,
    onMenu: (Message?) -> Unit,
    composer: @Composable () -> Unit,
    media: @Composable (String) -> Unit,
) {
    val p = LocalChatPalette.current
    val thread = state.selected ?: return
    val account = state.account ?: return
    val list = rememberLazyListState()
    LaunchedEffect(thread.id, list) {
        snapshotFlow { list.firstVisibleItemIndex == 0 }.collect(onAtBottom)
    }
    Column(
        Modifier.fillMaxSize().background(p.chat).semantics {
            contentDescription = "Conversa ${thread.name}"
        }
    ) {
        Row(
            Modifier.fillMaxWidth()
                .background(p.panel)
                .padding(end = 6.dp, top = 6.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ChatIconButton(
                Glyph.Back,
                "Voltar às conversas",
                enabled = !state.busy,
                onClick = onBack,
            )
            ChatAvatar(thread.name, thread.group, 40)
            Column(
                Modifier.weight(1f).padding(horizontal = 10.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    thread.name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val typing = state.people.filter { it.id != account.id && it.typing }
                Text(
                    if (typing.isNotEmpty())
                        "${typing.joinToString {it.name.substringBefore(' ')}} digitando…"
                    else if (thread.group) "${state.people.size} participantes"
                    else "Conversa privada",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (typing.isNotEmpty()) p.accent else p.muted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            ChatIconButton(
                Glyph.Settings,
                "Configurações",
                enabled = !state.recording && !state.busy,
                onClick = onSettings,
            )
        }
        HorizontalDivider(color = p.line, thickness = .5.dp)
        if (state.busy)
            LinearProgressIndicator(Modifier.fillMaxWidth(), color = p.accent, trackColor = p.soft)
        if (state.notice != null) SyncNotice(state.notice)
        LazyColumn(
            Modifier.weight(1f).fillMaxWidth(),
            state = list,
            reverseLayout = true,
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val typing = state.people.filter { it.id != account.id && it.typing }
            if (typing.isNotEmpty())
                item(key = "typing") {
                    Row(
                        Modifier.padding(vertical = 6.dp, horizontal = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        ChatIcon(Glyph.Chat, modifier = Modifier.size(16.dp), tint = p.accent)
                        Text(
                            "${typing.joinToString {it.name.substringBefore(' ')}} ${if(typing.size==1)"está digitando" else "estão digitando"}…",
                            color = p.accent,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            items(state.messages.asReversed(), key = { it.id }) { msg ->
                MessageBubble(
                    msg,
                    state,
                    menuMessage?.id == msg.id,
                    { onMenu(msg) },
                    { onMenu(null) },
                    {
                        onReply(msg)
                        onMenu(null)
                    },
                    { everyone ->
                        onDelete(msg, everyone)
                        onMenu(null)
                    },
                    media,
                )
            }
            if (state.messages.isEmpty())
                item(key = "empty") {
                    Box(
                        Modifier.fillMaxWidth().padding(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "Comece a conversa com uma mensagem.",
                            color = p.muted,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            if (state.older)
                item(key = "older") {
                    TextButton(
                        onClick = onHistory,
                        enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Carregar mensagens anteriores")
                    }
                }
        }
        HorizontalDivider(color = p.line, thickness = .5.dp)
        composer()
    }
}

@Composable
private fun MessageBubble(
    msg: Message,
    state: NativeState,
    expanded: Boolean,
    open: () -> Unit,
    close: () -> Unit,
    reply: () -> Unit,
    delete: (Boolean) -> Unit,
    media: @Composable (String) -> Unit,
) {
    val p = LocalChatPalette.current
    val mine = msg.sender == state.account?.id
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val width = (maxWidth * .88f).coerceAtMost(520.dp)
        Surface(
            Modifier.align(if (mine) Alignment.CenterEnd else Alignment.CenterStart)
                .widthIn(min = 96.dp, max = width),
            color = if (mine) p.bubble else p.panel,
            shape =
                RoundedCornerShape(
                    topStart = if (mine) 16.dp else 4.dp,
                    topEnd = if (mine) 4.dp else 16.dp,
                    bottomEnd = 16.dp,
                    bottomStart = 16.dp,
                ),
        ) {
            Box {
                Column(Modifier.padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 8.dp)) {
                    // Reserve a small corner for the anchored menu, without a large author row.
                    if (state.selected?.group == true && !mine)
                        Text(
                            state.people.find { it.id == msg.sender }?.name ?: "Participante",
                            color = p.accent,
                            style = MaterialTheme.typography.labelLarge,
                            modifier = Modifier.padding(end = 36.dp, bottom = 4.dp),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    else if (msg.reply != null || msg.attachment != null)
                        Spacer(Modifier.height(20.dp))
                    if (msg.reply != null && !msg.deleted) {
                        val original = state.messages.find { it.id == msg.reply && !it.deleted }
                        Row(
                            Modifier.fillMaxWidth()
                                .background(p.canvas.copy(alpha = .65f), RoundedCornerShape(10.dp))
                                .padding(8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Box(
                                Modifier.width(3.dp)
                                    .height(36.dp)
                                    .background(p.accent, RoundedCornerShape(2.dp))
                            )
                            Text(
                                original?.text?.takeIf { it.isNotBlank() }?.take(180)
                                    ?: if (original?.attachment != null) "Áudio ou anexo"
                                    else "Mensagem indisponível",
                                style = MaterialTheme.typography.bodySmall,
                                color = p.muted,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                    }
                    if (msg.attachment != null && !msg.deleted) media(msg.attachment)
                    if (msg.text.isNotBlank())
                        Text(
                            msg.text,
                            modifier =
                                Modifier.padding(
                                    end =
                                        if (
                                            !(state.selected?.group == true && !mine) &&
                                                msg.reply == null &&
                                                msg.attachment == null
                                        )
                                            24.dp
                                        else 0.dp
                                ),
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (msg.deleted) p.muted else p.ink,
                        )
                    Row(
                        Modifier.align(Alignment.End).padding(top = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            nativeTime(msg.created),
                            style = MaterialTheme.typography.labelSmall,
                            color = p.muted,
                        )
                        if (mine) {
                            val people = state.people.filter { it.id != state.account?.id }
                            val read =
                                people.isNotEmpty() &&
                                    people.all { it.read != null && it.read >= msg.seq }
                            val received =
                                people.isNotEmpty() && people.all { it.received >= msg.seq }
                            ChatIcon(
                                if (read || received) Glyph.Checks else Glyph.Check,
                                if (read) "Lida" else if (received) "Recebida" else "Enviada",
                                Modifier.size(14.dp),
                                tint = if (read) p.accent else p.muted,
                            )
                        }
                    }
                }
                Box(Modifier.align(Alignment.TopEnd)) {
                    IconButton(
                        onClick = open,
                        enabled = !state.busy,
                        modifier = Modifier.size(40.dp),
                    ) {
                        ChatIcon(Glyph.Down, "Opções da mensagem", Modifier.size(17.dp))
                    }
                    DropdownMenu(
                        expanded = expanded,
                        onDismissRequest = close,
                        shape = RoundedCornerShape(14.dp),
                        containerColor = p.panel,
                    ) {
                        if (!msg.deleted)
                            DropdownMenuItem(
                                text = { Text("Responder") },
                                leadingIcon = { ChatIcon(Glyph.Reply) },
                                onClick = reply,
                            )
                        DropdownMenuItem(
                            text = { Text("Apagar para mim") },
                            leadingIcon = { ChatIcon(Glyph.Trash) },
                            onClick = { delete(false) },
                        )
                        if (mine && !msg.deleted)
                            DropdownMenuItem(
                                text = { Text("Apagar para todos") },
                                leadingIcon = { ChatIcon(Glyph.Trash) },
                                onClick = { delete(true) },
                            )
                    }
                }
            }
        }
    }
}

@Composable
internal fun ComposerContent(
    state: NativeState,
    onText: (String) -> Unit,
    onReplyCancel: () -> Unit,
    record: () -> Unit,
    discardRecording: () -> Unit,
    discardVoice: () -> Unit,
    send: () -> Unit,
    sendVoice: () -> Unit,
) {
    val p = LocalChatPalette.current
    val focus = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    LaunchedEffect(state.reply?.id, state.recording) {
        if (state.reply != null && !state.recording) {
            focus.requestFocus()
            keyboard?.show()
        }
    }
    Column(
        Modifier.fillMaxWidth()
            .background(p.panel)
            .navigationBarsPadding()
            .imePadding()
            .padding(horizontal = 10.dp, vertical = 10.dp)
    ) {
        if (state.reply != null)
            Row(
                Modifier.fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .background(p.soft, RoundedCornerShape(12.dp))
                    .padding(start = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
                    Text(
                        "Respondendo",
                        style = MaterialTheme.typography.labelSmall,
                        color = p.accent,
                    )
                    Text(
                        state.reply.text.take(100).ifBlank { "Áudio ou anexo" },
                        style = MaterialTheme.typography.bodySmall,
                        color = p.muted,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                ChatIconButton(Glyph.Close, "Cancelar resposta", onClick = onReplyCancel)
            }
        if (state.recording)
            Row(
                Modifier.fillMaxWidth()
                    .background(p.canvas, RoundedCornerShape(26.dp))
                    .padding(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ChatIconButton(Glyph.Trash, "Descartar áudio", onClick = discardRecording)
                Column(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                    Text(
                        "Gravando áudio",
                        color = p.accent,
                        style = MaterialTheme.typography.labelSmall,
                    )
                    Text(
                        "${state.seconds/60}:${(state.seconds%60).toString().padStart(2,'0')}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 16.sp,
                    )
                }
                SendControl("Enviar áudio", true, state.busy, sendVoice)
            }
        else {
            if (state.voice != null)
                Row(
                    Modifier.fillMaxWidth().padding(bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ChatIcon(Glyph.Mic, tint = p.accent)
                    Text(
                        "Áudio pronto para enviar",
                        Modifier.weight(1f).padding(start = 8.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = p.muted,
                    )
                    ChatIconButton(
                        Glyph.Close,
                        "Remover áudio",
                        enabled = !state.busy,
                        onClick = discardVoice,
                    )
                }
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Surface(
                    Modifier.weight(1f),
                    color = p.canvas,
                    shape = RoundedCornerShape(24.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, p.line),
                ) {
                    BasicTextField(
                        state.text,
                        onText,
                        enabled = !state.busy && state.selected?.canSend == true,
                        maxLines = 4,
                        modifier =
                            Modifier.fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 13.dp)
                                .heightIn(min = 22.dp, max = 110.dp)
                                .focusRequester(focus)
                                .semantics { contentDescription = "Mensagem" },
                        textStyle = MaterialTheme.typography.bodyMedium.copy(color = p.ink),
                        cursorBrush = SolidColor(p.accent),
                        decorationBox = { inner ->
                            if (state.text.isEmpty())
                                Text(
                                    "Escreva uma mensagem…",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = p.muted,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            inner()
                        },
                    )
                }
                if (state.voice == null)
                    ChatIconButton(
                        Glyph.Mic,
                        "Gravar áudio",
                        enabled = !state.busy && state.selected?.canSend == true,
                        onClick = record,
                    )
                SendControl(
                    "Enviar mensagem",
                    state.selected?.canSend == true &&
                        (state.text.isNotBlank() || state.voice != null),
                    state.busy,
                    send,
                )
            }
        }
    }
}

@Composable
private fun SendControl(label: String, enabled: Boolean, busy: Boolean, click: () -> Unit) {
    FilledIconButton(
        onClick = click,
        enabled = enabled && !busy,
        modifier = Modifier.size(48.dp),
        shape = RoundedCornerShape(18.dp),
    ) {
        if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        else
            ChatIcon(
                Glyph.Send,
                label,
                tint =
                    if (enabled) MaterialTheme.colorScheme.onPrimary
                    else LocalChatPalette.current.muted,
            )
    }
}
