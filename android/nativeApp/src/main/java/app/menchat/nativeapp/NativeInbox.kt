package app.menchat.nativeapp

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
internal fun ConversationInbox(
    state: NativeState,
    dark: Boolean,
    onSelect: (Conversation) -> Unit,
    onNew: () -> Unit,
    onGroup: () -> Unit,
    onSettings: () -> Unit,
    onTheme: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalChatPalette.current
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("Todas") }
    val visible =
        state.threads.filter {
            it.name.contains(query.trim(), ignoreCase = true) &&
                when (filter) {
                    "Não lidas" -> it.unread > 0
                    "Grupos" -> it.group
                    else -> true
                }
        }
    Column(
        modifier.fillMaxSize().background(p.panel).semantics {
            contentDescription = "Lista de conversas"
        }
    ) {
        Row(
            Modifier.fillMaxWidth().padding(start = 18.dp, end = 6.dp, top = 6.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.weight(1f)) { BrandMark(compact = true) }
            ChatIconButton(
                if (dark) Glyph.Sun else Glyph.Moon,
                if (dark) "Ativar modo claro" else "Ativar modo escuro",
                onClick = onTheme,
            )
            ChatIconButton(
                Glyph.Settings,
                "Configurações",
                enabled = !state.recording && !state.busy,
                onClick = onSettings,
            )
        }
        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 6.dp, top = 10.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Conversas",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.weight(1f),
            )
            ChatIconButton(
                Glyph.Plus,
                "Nova conversa",
                enabled = !state.busy && !state.recording,
                onClick = onNew,
            )
            ChatIconButton(
                Glyph.Group,
                "Criar grupo",
                enabled = !state.busy && !state.recording,
                onClick = onGroup,
            )
        }
        Surface(
            Modifier.padding(horizontal = 18.dp).fillMaxWidth(),
            color = p.canvas,
            shape = RoundedCornerShape(14.dp),
        ) {
            Row(
                Modifier.padding(horizontal = 14.dp).heightIn(min = 48.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ChatIcon(Glyph.Search, modifier = Modifier.size(18.dp))
                BasicTextField(
                    query,
                    { query = it },
                    modifier =
                        Modifier.weight(1f).padding(vertical = 12.dp).semantics {
                            contentDescription = "Buscar conversa"
                        },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(color = p.ink),
                    cursorBrush = SolidColor(p.accent),
                    decorationBox = { inner ->
                        if (query.isEmpty())
                            Text(
                                "Buscar conversa",
                                color = p.muted,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        inner()
                    },
                )
                if (query.isNotEmpty())
                    ChatIconButton(Glyph.Close, "Limpar busca", onClick = { query = "" })
            }
        }
        Row(
            Modifier.padding(horizontal = 18.dp, vertical = 12.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf("Todas", "Não lidas", "Grupos").forEach { name ->
                FilterChip(
                    selected = filter == name,
                    onClick = { filter = name },
                    label = { Text(name) },
                    shape = RoundedCornerShape(24.dp),
                    border = null,
                    colors =
                        FilterChipDefaults.filterChipColors(
                            containerColor = p.canvas,
                            labelColor = p.muted,
                            selectedContainerColor = p.soft,
                            selectedLabelColor = p.accent,
                        ),
                )
            }
        }
        HorizontalDivider(color = p.line, thickness = .5.dp)
        if (state.busy)
            LinearProgressIndicator(Modifier.fillMaxWidth(), color = p.accent, trackColor = p.soft)
        if (state.selected == null && state.notice != null) SyncNotice(state.notice)
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(vertical = 6.dp)) {
            if (visible.isEmpty())
                item {
                    Column(
                        Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 60.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        ChatIcon(Glyph.Chat, modifier = Modifier.size(42.dp), tint = p.accent)
                        Text(
                            if (state.threads.isEmpty()) "Seu círculo começa aqui"
                            else "Nenhuma conversa encontrada",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Text(
                            if (state.threads.isEmpty())
                                "Use o código de um contato para começar a conversar."
                            else "Experimente outro nome ou filtro.",
                            color = p.muted,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        if (state.threads.isEmpty())
                            TextButton(onClick = onNew, enabled = !state.busy && !state.recording) {
                                Text("Nova conversa")
                            }
                    }
                }
            items(visible, key = { it.id }) { thread ->
                val active = state.selected?.id == thread.id
                Row(
                    Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        .fillMaxWidth()
                        .background(if (active) p.soft else p.panel, RoundedCornerShape(14.dp))
                        .clickable(enabled = !state.busy) { onSelect(thread) }
                        .padding(horizontal = 12.dp, vertical = 13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    ChatAvatar(thread.name, thread.group)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            thread.name,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            thread.preview,
                            style = MaterialTheme.typography.bodySmall,
                            color = p.muted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Column(
                        horizontalAlignment = Alignment.End,
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        thread.lastAt?.let {
                            Text(
                                nativeTime(it),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (thread.unread > 0) p.accent else p.muted,
                            )
                        }
                        if (thread.unread > 0)
                            Surface(
                                color = p.accent,
                                shape = RoundedCornerShape(20.dp),
                                modifier =
                                    Modifier.semantics {
                                        contentDescription = "${thread.unread} mensagens não lidas"
                                    },
                            ) {
                                Text(
                                    if (thread.unread > 99) "99+" else thread.unread.toString(),
                                    Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                    }
                }
            }
        }
    }
}

@Composable
internal fun SyncNotice(message: String) {
    val p = LocalChatPalette.current
    Row(
        Modifier.fillMaxWidth().background(p.soft).padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        ChatIcon(Glyph.Info, tint = p.accent)
        Text(message, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
    }
}

@Composable
internal fun AdaptiveChatWorkspace(
    state: NativeState,
    dark: Boolean,
    onSelect: (Conversation?) -> Unit,
    onNew: () -> Unit,
    onGroup: () -> Unit,
    onSettings: () -> Unit,
    onTheme: () -> Unit,
    conversation: @Composable () -> Unit,
) {
    val p = LocalChatPalette.current
    BoxWithConstraints(
        Modifier.fillMaxSize()
            .background(p.chat)
            .windowInsetsPadding(
                WindowInsets.systemBars.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)
            )
    ) {
        if (maxWidth >= 840.dp)
            Row(Modifier.fillMaxSize()) {
                ConversationInbox(
                    state,
                    dark,
                    { onSelect(it) },
                    onNew,
                    onGroup,
                    onSettings,
                    onTheme,
                    Modifier.width(320.dp).navigationBarsPadding(),
                )
                VerticalDivider(color = p.line)
                Box(Modifier.weight(1f).fillMaxHeight()) {
                    if (state.selected != null) conversation()
                    else
                        Column(
                            Modifier.align(Alignment.Center).padding(40.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            BrandMark()
                            Text(
                                "Escolha uma conversa para começar",
                                color = p.muted,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                }
            }
        else if (state.selected == null)
            ConversationInbox(
                state,
                dark,
                { onSelect(it) },
                onNew,
                onGroup,
                onSettings,
                onTheme,
                Modifier.navigationBarsPadding(),
            )
        else conversation()
    }
}
