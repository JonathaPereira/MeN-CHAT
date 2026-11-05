@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.menchat.nativeapp

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

@Composable
internal fun NativeSettings(
    state: NativeState,
    version: String,
    change: (NativeOptions) -> Unit,
    profile: () -> Unit,
    notifications: @Composable () -> Unit,
    invites: () -> Unit,
    logout: () -> Unit,
    close: () -> Unit,
) {
    var tab by remember { mutableStateOf<String?>(null) }
    val p = LocalChatPalette.current
    val o = state.options
    val account = state.account ?: return
    Dialog(
        onDismissRequest = { if (tab != null) tab = null else close() },
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        BackHandler(tab != null) { tab = null }
        Surface(Modifier.fillMaxSize(), color = p.canvas) {
            Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                Row(
                    Modifier.fillMaxWidth().padding(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ChatIconButton(
                        Glyph.Back,
                        "Voltar das configurações",
                        onClick = { if (tab != null) tab = null else close() },
                    )
                    Text(tab ?: "Configurações", style = MaterialTheme.typography.titleLarge)
                }
                Column(
                    Modifier.weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    when (tab) {
                        null -> {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(16.dp),
                            ) {
                                ChatAvatar(account.name, false, 58, account.avatarPath)
                                Column(Modifier.weight(1f)) {
                                    Text(account.name, style = MaterialTheme.typography.titleMedium)
                                    Text(
                                        account.status,
                                        color = p.muted,
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                }
                            }
                            SettingsEntry(Glyph.Person, "Meu perfil", profile)
                            SettingsEntry(Glyph.Sun, "Aparência") { tab = "Aparência" }
                            SettingsEntry(Glyph.Bell, "Notificações") { tab = "Notificações" }
                            SettingsEntry(Glyph.Chat, "Conversas e áudio") {
                                tab = "Conversas e áudio"
                            }
                            SettingsEntry(Glyph.Download, "Dados e armazenamento") {
                                tab = "Dados e armazenamento"
                            }
                            SettingsEntry(Glyph.Shield, "Privacidade") { tab = "Privacidade" }
                            if (account.admin)
                                SettingsEntry(Glyph.Plus, "Convidar pessoas", invites)
                            OutlinedButton(
                                onClick = logout,
                                enabled = !state.busy,
                                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                            ) {
                                Text("Sair da conta")
                            }
                            Text(
                                "MenChat $version",
                                Modifier.align(Alignment.CenterHorizontally),
                                color = p.muted,
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                        "Aparência" -> {
                            Text("Tema", style = MaterialTheme.typography.titleMedium)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                listOf(
                                        "system" to "Sistema",
                                        "light" to "Claro",
                                        "dark" to "Escuro",
                                    )
                                    .forEach { (key, label) ->
                                        FilterChip(
                                            selected = o.theme == key,
                                            onClick = { change(o.copy(theme = key)) },
                                            label = { Text(label) },
                                        )
                                    }
                            }
                            Text("Tamanho do texto", style = MaterialTheme.typography.titleMedium)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                listOf(.9f to "Pequeno", 1f to "Padrão", 1.15f to "Grande")
                                    .forEach { (scale, label) ->
                                        FilterChip(
                                            selected = o.textScale == scale,
                                            onClick = { change(o.copy(textScale = scale)) },
                                            label = { Text(label) },
                                        )
                                    }
                            }
                            Text(
                                "As opções respeitam também o tamanho de fonte definido no Android.",
                                color = p.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        "Notificações" -> {
                            SettingToggle("Receber avisos", o.notifications) {
                                change(o.copy(notifications = it))
                            }
                            SettingToggle("Avisos dentro do aplicativo", o.inApp) {
                                change(o.copy(inApp = it))
                            }
                            SettingToggle("Som MenChat", o.sound) { change(o.copy(sound = it)) }
                            SettingToggle("Vibrar", o.vibration) { change(o.copy(vibration = it)) }
                            SettingToggle("Prévia nos avisos internos", o.previews) {
                                change(o.copy(previews = it))
                            }
                            SettingToggle("Avisar somente fora da conversa", o.onlyAway) {
                                change(o.copy(onlyAway = it))
                            }
                            notifications()
                            Text(
                                "Notificações em segundo plano usam um aviso genérico, sem texto privado. Volume, silêncio e bateria também seguem as configurações do Android.",
                                color = p.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        "Conversas e áudio" -> {
                            SettingToggle("Enter para enviar", o.enterSends) {
                                change(o.copy(enterSends = it))
                            }
                            Text(
                                "Com teclado físico: Shift+Enter quebra a linha.",
                                color = p.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                            SettingToggle("Redução de ruído na gravação", o.noiseSuppression) {
                                change(o.copy(noiseSuppression = it))
                            }
                            Text(
                                "Velocidade dos áudios",
                                style = MaterialTheme.typography.titleMedium,
                            )
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                listOf(1f, 1.25f, 1.5f, 2f).forEach { speed ->
                                    FilterChip(
                                        selected = o.playbackRate == speed,
                                        onClick = { change(o.copy(playbackRate = speed)) },
                                        label = { Text("${speed}×") },
                                    )
                                }
                            }
                            Text(
                                "Toque no microfone para gravar e na seta para enviar. Até dois minutos por gravação.",
                                color = p.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        "Dados e armazenamento" -> {
                            SettingToggle("Economia de dados", o.dataSaver) {
                                change(o.copy(dataSaver = it))
                            }
                            SettingToggle("Prévias de fotos automáticas", o.autoImages) {
                                change(o.copy(autoImages = it))
                            }
                            SettingToggle("Player de áudio automático", o.autoAudio) {
                                change(o.copy(autoAudio = it))
                            }
                            SettingToggle("Prévias de vídeo automáticas", o.autoVideo) {
                                change(o.copy(autoVideo = it))
                            }
                            Text(
                                "Estas opções controlam o carregamento das prévias. Mídia nunca toca sozinha e salvar no aparelho exige tocar em baixar. Economia de dados exige um toque para carregar.",
                                color = p.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                            Text(
                                "Fotos: 5 MB · vídeos: 25 MB · áudio/documentos: 10 MB. Limite de 100 MB por pessoa em 24 horas e 500 MB reservados para o app.",
                                color = p.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        "Privacidade" -> {
                            Text(
                                "Seu código: ${account.code}",
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Text(
                                "Visibilidade do código, busca, leituras e digitação são sincronizadas com sua conta.",
                                color = p.muted,
                            )
                            OutlinedButton(onClick = profile, modifier = Modifier.fillMaxWidth()) {
                                Text("Editar privacidade do perfil")
                            }
                            Text(
                                "Conversas privadas são restritas aos participantes. O MenChat ainda não oferece criptografia ponta a ponta para mensagens armazenadas.",
                                color = p.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun SettingToggle(
    label: String,
    value: Boolean,
    enabled: Boolean = true,
    change: (Boolean) -> Unit,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            label,
            Modifier.weight(1f).padding(end = 12.dp),
            style = MaterialTheme.typography.bodyMedium,
        )
        Switch(
            value,
            change,
            enabled = enabled,
            modifier = Modifier.semantics { contentDescription = label },
        )
    }
}

@Composable
internal fun SettingsEntry(glyph: Glyph, label: String, click: () -> Unit) {
    Surface(
        onClick = click,
        color = LocalChatPalette.current.panel,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
    ) {
        Row(
            Modifier.fillMaxWidth()
                .heightIn(min = 60.dp)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ChatIcon(glyph, tint = LocalChatPalette.current.accent)
            Text(label, Modifier.weight(1f).padding(horizontal = 14.dp))
            ChatIcon(Glyph.Next)
        }
    }
}
