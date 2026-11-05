package app.menchat.nativeapp

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier

@Composable
internal fun rememberNotificationPermission(model: MainModel): (Boolean) -> Unit {
    var actor by remember { mutableStateOf<String?>(null) }
    var activate by remember { mutableStateOf(false) }
    val launcher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (actor != null && actor == model.state.value.account?.id) {
                if (granted) {
                    if (activate) model.enablePush()
                    else model.notifications.test(model.state.value.options)
                } else
                    model.error(
                        "As notificações foram bloqueadas. Você pode permiti-las nas configurações do Android."
                    )
            }
            actor = null
        }
    return { enable ->
        actor = model.state.value.account?.id
        activate = enable
        if (Build.VERSION.SDK_INT >= 33 && !model.notifications.permitted())
            launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
        else if (enable) model.enablePush() else model.notifications.test(model.state.value.options)
    }
}

@Composable
internal fun NativeNotificationControls(
    model: MainModel,
    state: NativeState,
    permission: (Boolean) -> Unit,
) {
    Text(
        state.pushStatus ?: "Verificando notificações…",
        style = MaterialTheme.typography.bodySmall,
        color = LocalChatPalette.current.muted,
    )
    OutlinedButton(
        onClick = { permission(true) },
        enabled = state.pushReady && !state.busy,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text("Ativar com o app fechado")
    }
    OutlinedButton(
        onClick = { model.notifications.sound(true) },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text("Ouvir som MenChat")
    }
    OutlinedButton(onClick = { permission(false) }, modifier = Modifier.fillMaxWidth()) {
        Text("Testar notificação")
    }
    TextButton(onClick = { model.notifications.systemSettings(state.options) }) {
        Text("Configurações de notificações do Android")
    }
}
