package app.menchat.nativeapp

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

internal fun groupActions(
    thread: Conversation,
    people: List<Person>,
    actor: String,
    target: Person,
): Set<String> {
    if (!thread.group || actor == target.id || people.find { it.id == actor }?.role != "admin")
        return emptySet()
    val owner = thread.owner == actor
    val result = mutableSetOf<String>()
    if (owner) result += "transfer"
    if (target.id != thread.creator && target.id != thread.owner) {
        if (target.role == "member") result += "promote" else if (owner) result += "demote"
        if (owner || target.role == "member") result += "remove"
    }
    return result
}

@Composable
internal fun NativeGroupDetails(
    state: NativeState,
    manage: (String, String?, String?, String?) -> Unit,
    mute: () -> Unit,
    close: () -> Unit,
) {
    val thread = state.selected ?: return
    val account = state.account ?: return
    val admin = state.people.find { it.id == account.id }?.role == "admin"
    var name by remember(thread.id) { mutableStateOf(thread.name) }
    var code by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf<Pair<String, Person?>?>(null) }
    val p = LocalChatPalette.current
    Dialog(
        onDismissRequest = { if (!state.busy) close() },
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = p.canvas) {
            Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                Row {
                    ChatIconButton(
                        Glyph.Back,
                        "Fechar detalhes",
                        enabled = !state.busy,
                        onClick = close,
                    )
                    Text(
                        if (thread.group) "Detalhes do grupo" else "Contato",
                        Modifier.padding(vertical = 12.dp),
                        style = MaterialTheme.typography.titleLarge,
                    )
                }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                Column(
                    Modifier.weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Text(thread.name, style = MaterialTheme.typography.headlineSmall)
                    SettingToggle("Silenciar conversa", thread.id in state.options.muted) { mute() }
                    if (thread.group && admin) {
                        OutlinedTextField(
                            name,
                            { if (it.length <= 60) name = it },
                            label = { Text("Nome do grupo") },
                            enabled = !state.busy,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedButton(
                            onClick = { manage("rename", null, null, name.trim()) },
                            enabled = !state.busy && name.isNotBlank(),
                        ) {
                            Text("Salvar nome")
                        }
                        OutlinedTextField(
                            code,
                            { code = it.filter { it.isLetterOrDigit() }.uppercase().take(6) },
                            label = { Text("Adicionar por código") },
                            singleLine = true,
                            enabled = !state.busy,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedButton(
                            onClick = {
                                manage("add", null, code, null)
                                code = ""
                            },
                            enabled = !state.busy && Regex("[A-Z0-9]{6}").matches(code),
                        ) {
                            Text("Adicionar participante")
                        }
                    }
                    Text(
                        if (thread.group) "${state.people.size} participantes" else "Perfil",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    state.people.forEach { person ->
                        Surface(
                            color = p.panel,
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                        ) {
                            Column(
                                Modifier.fillMaxWidth().padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Row {
                                    ChatAvatar(person.name, false, 42, person.avatarPath)
                                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                                        Text(
                                            person.name,
                                            style = MaterialTheme.typography.titleMedium,
                                        )
                                        if (person.status.isNotBlank())
                                            Text(
                                                person.status,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = p.muted,
                                            )
                                        Text(
                                            person.code?.let { "Código: $it" } ?: "Código oculto",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = p.muted,
                                        )
                                        if (thread.group)
                                            Text(
                                                if (person.id == thread.creator) "Criador"
                                                else if (person.id == thread.owner) "Proprietário"
                                                else if (person.role == "admin") "Administrador"
                                                else "Membro",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = p.accent,
                                            )
                                    }
                                }
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    groupActions(thread, state.people, account.id, person)
                                        .forEach { action ->
                                            TextButton(
                                                onClick = {
                                                    if (action in listOf("remove", "transfer"))
                                                        confirm = action to person
                                                    else manage(action, person.id, null, null)
                                                },
                                                enabled = !state.busy,
                                            ) {
                                                Text(
                                                    when (action) {
                                                        "remove" -> "Remover"
                                                        "promote" -> "Tornar admin"
                                                        "demote" -> "Remover admin"
                                                        else -> "Transferir propriedade"
                                                    }
                                                )
                                            }
                                        }
                                }
                            }
                        }
                    }
                    if (thread.group) {
                        Text(
                            "O criador e o proprietário são protegidos. Quem entra vê o histórico; sair ou ser removido encerra o acesso.",
                            color = p.muted,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        OutlinedButton(
                            onClick = { confirm = "leave" to null },
                            enabled = !state.busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("Sair do grupo")
                        }
                    }
                }
            }
        }
        confirm?.let { (action, person) ->
            AlertDialog(
                onDismissRequest = { if (!state.busy) confirm = null },
                title = {
                    Text(
                        when (action) {
                            "remove" -> "Remover ${person?.name}?"
                            "transfer" -> "Transferir o grupo para ${person?.name}?"
                            else -> "Sair do grupo?"
                        }
                    )
                },
                text = {
                    Text(
                        if (
                            action == "leave" && thread.owner == account.id && state.people.size > 1
                        )
                            "Transfira a propriedade antes de sair. Você pode escolher um participante nesta tela."
                        else "Esta alteração será aplicada ao grupo."
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            confirm = null
                            manage(action, person?.id, null, null)
                        },
                        enabled =
                            !state.busy &&
                                !(action == "leave" &&
                                    thread.owner == account.id &&
                                    state.people.size > 1),
                    ) {
                        Text("Confirmar")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { confirm = null }, enabled = !state.busy) {
                        Text("Cancelar")
                    }
                },
            )
        }
    }
}

@Composable
internal fun NativeCreateGroup(
    busy: Boolean,
    submit: (String, List<String>) -> Unit,
    close: () -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var codes by remember { mutableStateOf("") }
    val values =
        codes.split(Regex("[\\s,;]+")).filter { it.isNotBlank() }.map { it.uppercase() }.distinct()
    AlertDialog(
        onDismissRequest = { if (!busy) close() },
        title = { Text("Criar grupo") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    name,
                    { if (it.length <= 60) name = it },
                    label = { Text("Nome do grupo") },
                    enabled = !busy,
                )
                OutlinedTextField(
                    codes,
                    { if (it.length <= 160) codes = it },
                    label = { Text("Códigos dos participantes") },
                    minLines = 2,
                    maxLines = 4,
                    enabled = !busy,
                )
                Text(
                    "Opcional: até 19 códigos de contas já ativas, separados por espaço ou vírgula. Sem códigos, o grupo começa somente com você.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { submit(name.trim(), values) },
                enabled =
                    !busy &&
                        name.isNotBlank() &&
                        values.size <= 19 &&
                        values.all { Regex("[A-Z0-9]{6}").matches(it) },
            ) {
                Text("Criar grupo")
            }
        },
        dismissButton = { TextButton(onClick = close, enabled = !busy) { Text("Cancelar") } },
    )
}
