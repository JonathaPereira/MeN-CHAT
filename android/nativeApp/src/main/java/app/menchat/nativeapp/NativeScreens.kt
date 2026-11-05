@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.menchat.nativeapp

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

@Composable
internal fun MenChatNative(model: MainModel) {
    val selections = rememberSelections(model)
    val context = LocalContext.current
    val signer: suspend (String) -> String =
        remember(model) {
            { path -> withContext(Dispatchers.IO) { model.gateway.avatarUrl(path) } }
        }
    val version = remember {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName.orEmpty()
    }
    val view = LocalView.current
    val state by model.state.collectAsState()
    val dark =
        when (state.options.theme) {
            "system" -> isSystemInDarkTheme()
            "light" -> false
            else -> true
        }
    val notificationPermission = rememberNotificationPermission(model)
    val callPermission = rememberCallPermission(model)
    val callState by model.calls.state.collectAsState()
    val owner = LocalLifecycleOwner.current
    var settings by remember { mutableStateOf(false) }
    var newConversation by remember { mutableStateOf(false) }
    var createGroup by remember { mutableStateOf(false) }
    var selectionMenu by remember { mutableStateOf<String?>(null) }
    var draftPreview by remember { mutableStateOf(false) }
    var details by remember { mutableStateOf(false) }
    var favorites by remember { mutableStateOf(false) }
    var invites by remember { mutableStateOf(false) }
    var expressions by remember { mutableStateOf(false) }
    var stickers by remember { mutableStateOf(false) }
    var chatActions by remember { mutableStateOf(false) }
    var actionMessage by remember { mutableStateOf<Message?>(null) }
    val themeChange = {
        model.options(state.options.copy(theme = if (dark) "light" else "dark"))
        Unit
    }
    LaunchedEffect(state.account?.id) { if (state.account != null) model.initializeServices() }
    SideEffect {
        (context as? Activity)?.let { activity ->
            WindowCompat.getInsetsController(activity.window, view).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
        model.covered =
            settings ||
                newConversation ||
                createGroup ||
                actionMessage != null ||
                state.error != null ||
                state.profile != null ||
                selectionMenu != null ||
                details ||
                favorites ||
                invites ||
                expressions ||
                stickers ||
                chatActions ||
                state.stickerSource != null ||
                callState.busy ||
                callState.incoming != null ||
                (callState.active != null && callState.expanded)
        NativeNotifications.visibleThread =
            state.selected?.id?.takeIf {
                model.foreground &&
                    model.atBottom &&
                    !model.covered &&
                    !model.mediaCovered &&
                    !model.pickerCovered
            }
    }
    LaunchedEffect(favorites, state.selected?.id) {
        if (favorites)
            while (true) {
                delay(3000)
                model.refreshFavorites()
            }
    }
    LaunchedEffect(owner, state.account?.id) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                model.refresh()
                delay(if (model.state.value.selected == null) 5000 else 3000)
            }
        }
    }
    LaunchedEffect(state.selected?.id) {
        actionMessage = null
        selectionMenu = null
        draftPreview = false
        details = false
        favorites = false
        chatActions = false
        expressions = false
        stickers = false
        if (state.selected != null) model.loadStars()
    }
    BackHandler(
        state.selected != null &&
            !state.busy &&
            actionMessage == null &&
            !settings &&
            !newConversation &&
            !createGroup &&
            state.profile == null &&
            !draftPreview &&
            selectionMenu == null &&
            !details &&
            !favorites &&
            !invites &&
            !expressions &&
            !stickers &&
            !chatActions &&
            state.stickerSource == null
    ) {
        model.select(null)
    }
    CompositionLocalProvider(LocalAvatarSigner provides signer) {
        MenChatTheme(dark, state.options.textScale) {
            val p = LocalChatPalette.current
            Surface(Modifier.fillMaxSize(), color = p.canvas) {
                when {
                    state.restoring ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(24.dp),
                            ) {
                                BrandMark()
                                CircularProgressIndicator(Modifier.size(26.dp), strokeWidth = 2.dp)
                            }
                        }
                    state.account == null -> NativeLogin(state.busy, model::login)
                    else ->
                        AdaptiveChatWorkspace(
                            state,
                            dark,
                            model::select,
                            { newConversation = true },
                            { createGroup = true },
                            { settings = true },
                            themeChange,
                        ) {
                            key(state.selected?.id) {
                                ConversationPane(
                                    state,
                                    { model.select(null) },
                                    { settings = true },
                                    model::reply,
                                    model::delete,
                                    model::history,
                                    model::bottom,
                                    actionMessage,
                                    { actionMessage = it },
                                    composer = {
                                        NativeComposer(
                                            model,
                                            state,
                                            { selectionMenu = "attach" },
                                            { selectionMenu = "camera" },
                                            { draftPreview = true },
                                            { expressions = true },
                                        )
                                    },
                                    media = { NativeMedia(model, it) },
                                    onDetails = { chatActions = true },
                                    onStar = model::star,
                                )
                            }
                        }
                }
                if (state.profile != null && state.account != null)
                    ProfileEditor(
                        state.account!!,
                        state.profile!!,
                        state.busy,
                        model::editProfile,
                        { selections.gallery(true) },
                        { selections.camera(false, true) },
                        model::removeProfilePhoto,
                        model::saveProfile,
                        model::closeProfile,
                    )
                if (draftPreview && state.attachment != null)
                    LocalMediaPreview(model, state.attachment!!, { draftPreview = false })
                if (selectionMenu != null)
                    ModalBottomSheet(
                        onDismissRequest = { selectionMenu = null },
                        containerColor = p.panel,
                    ) {
                        val camera = selectionMenu == "camera"
                        Text(
                            if (camera) "Câmera" else "Anexar",
                            Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                            style = MaterialTheme.typography.titleLarge,
                        )
                        if (camera) {
                            MediaChoice(Glyph.Camera, "Tirar foto") {
                                selectionMenu = null
                                selections.camera(false, false)
                            }
                            MediaChoice(Glyph.Video, "Gravar vídeo · até 2 minutos") {
                                selectionMenu = null
                                selections.camera(true, false)
                            }
                        } else {
                            MediaChoice(Glyph.Photo, "Fotos e vídeos") {
                                selectionMenu = null
                                selections.gallery(false)
                            }
                            MediaChoice(Glyph.File, "Documento") {
                                selectionMenu = null
                                selections.document(false)
                            }
                            MediaChoice(Glyph.Mic, "Arquivo de áudio") {
                                selectionMenu = null
                                selections.document(true)
                            }
                        }
                        Text(
                            "Fotos 5 MB · vídeos 25 MB · áudio e documentos 10 MB",
                            Modifier.padding(24.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = p.muted,
                        )
                    }
                if (state.error != null)
                    AlertDialog(
                        onDismissRequest = model::clearError,
                        icon = { ChatIcon(Glyph.Info, tint = p.accent) },
                        title = { Text("Não foi possível concluir") },
                        text = { Text(state.error!!) },
                        confirmButton = {
                            TextButton(onClick = model::clearError) { Text("Entendi") }
                        },
                    )
                if (newConversation)
                    TextPrompt(
                        "Nova conversa",
                        "Código do contato",
                        6,
                        true,
                        { newConversation = false },
                    ) {
                        newConversation = false
                        model.open(it)
                    }
                if (createGroup)
                    NativeCreateGroup(
                        state.busy,
                        { name, codes ->
                            createGroup = false
                            model.group(name, codes)
                        },
                        { createGroup = false },
                    )
                if (settings && state.account != null)
                    NativeSettings(
                        state,
                        version,
                        model::options,
                        {
                            settings = false
                            model.beginProfile()
                        },
                        { NativeNotificationControls(model, state, notificationPermission) },
                        {
                            settings = false
                            invites = true
                            model.loadInvitations()
                        },
                        {
                            settings = false
                            model.logout()
                        },
                        { settings = false },
                    )
                if (details && state.selected != null)
                    NativeGroupDetails(
                        state,
                        model::manageGroup,
                        {
                            val id = state.selected!!.id
                            model.options(
                                state.options.copy(
                                    muted =
                                        if (id in state.options.muted) state.options.muted - id
                                        else state.options.muted + id
                                )
                            )
                        },
                        { details = false },
                    )
                if (favorites)
                    NativeFavorites(
                        state,
                        model::star,
                        model::reply,
                        { NativeMedia(model, it) },
                        { favorites = false },
                    )
                if (invites && state.account?.admin == true)
                    NativeInvitations(
                        state,
                        model::invite,
                        model::revokeInvite,
                        {
                            invites = false
                            model.forgetInvitation()
                        },
                    )
                if (expressions)
                    NativeEmojiPicker(
                        model::insertEmoji,
                        if (state.selected?.group == true) state.people else emptyList(),
                        model::mention,
                        {
                            expressions = false
                            stickers = true
                        },
                        { expressions = false },
                    )
                if (stickers && state.stickerSource == null)
                    NativeStickerPicker(
                        state.stickers,
                        state.busy,
                        selections.sticker,
                        {
                            model.chooseSticker(it)
                            stickers = false
                        },
                        model::removeSticker,
                        { stickers = false },
                    )
                state.stickerSource?.let { source ->
                    NativeStickerEditor(source, state.busy, model::saveSticker, model::closeSticker)
                }
                if (chatActions && state.selected != null)
                    ModalBottomSheet(
                        onDismissRequest = { chatActions = false },
                        containerColor = p.panel,
                    ) {
                        if (state.callsReady && state.selected?.canSend == true) {
                            MediaChoice(Glyph.Phone, "Chamada de voz") {
                                chatActions = false
                                callPermission(false, false)
                            }
                            MediaChoice(Glyph.Video, "Chamada de vídeo") {
                                chatActions = false
                                callPermission(true, false)
                            }
                        }
                        MediaChoice(
                            Glyph.Info,
                            if (state.selected!!.group) "Detalhes e participantes"
                            else "Ver contato",
                        ) {
                            chatActions = false
                            details = true
                        }
                        MediaChoice(Glyph.Star, "Mensagens favoritas") {
                            chatActions = false
                            favorites = true
                            model.loadFavorites()
                        }
                    }
                if (state.account != null)
                    NativeCallScreen(model.calls, callState, state.account!!.id, callPermission)
                if (callState.active != null && !callState.expanded)
                    Box(
                        Modifier.fillMaxSize().safeDrawingPadding().padding(12.dp),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        FilledTonalButton(onClick = { model.calls.expand() }) {
                            Text("Chamada em andamento · Abrir")
                        }
                    }
                state.banner?.let { banner ->
                    LaunchedEffect(banner.key) {
                        delay(5000)
                        model.clearBanner()
                    }
                    Box(
                        Modifier.fillMaxSize().safeDrawingPadding().padding(12.dp),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        Snackbar(
                            action = {
                                TextButton(onClick = { model.openBanner(banner.thread) }) {
                                    Text("Ver")
                                }
                            },
                            dismissAction = {
                                TextButton(onClick = model::clearBanner) { Text("Fechar") }
                            },
                        ) {
                            Text("${banner.title}: ${banner.body}")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MediaChoice(glyph: Glyph, label: String, click: () -> Unit) {
    TextButton(
        onClick = click,
        modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(horizontal = 12.dp),
    ) {
        ChatIcon(glyph, tint = LocalChatPalette.current.accent)
        Text(
            label,
            Modifier.weight(1f).padding(horizontal = 16.dp),
            color = LocalChatPalette.current.ink,
        )
    }
}

@Composable
internal fun NativeLogin(busy: Boolean, onLogin: (String, String) -> Unit) {
    val p = LocalChatPalette.current
    val uriHandler = androidx.compose.ui.platform.LocalUriHandler.current
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
        Column(
            Modifier.fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .heightIn(min = maxHeight)
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Surface(
                Modifier.widthIn(max = 400.dp).fillMaxWidth(),
                color = p.panel,
                shape = RoundedCornerShape(28.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, p.line),
            ) {
                Column(
                    Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Box(Modifier.padding(bottom = 16.dp, top = 8.dp)) { BrandMark() }
                    OutlinedTextField(
                        email,
                        { email = it },
                        label = { Text("E-mail") },
                        singleLine = true,
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        keyboardOptions =
                            KeyboardOptions(
                                keyboardType = KeyboardType.Email,
                                imeAction = ImeAction.Next,
                            ),
                    )
                    OutlinedTextField(
                        password,
                        { password = it },
                        label = { Text("Senha") },
                        singleLine = true,
                        enabled = !busy,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        keyboardOptions =
                            KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done,
                            ),
                        keyboardActions =
                            KeyboardActions(onDone = { if (!busy) onLogin(email, password) }),
                    )
                    Button(
                        onClick = { onLogin(email, password) },
                        enabled = !busy && email.isNotBlank() && password.isNotBlank(),
                        modifier =
                            Modifier.fillMaxWidth().heightIn(min = 50.dp).padding(top = 4.dp),
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        if (busy)
                            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                        else Text("Entrar")
                    }
                    TextButton(
                        onClick = {
                            uriHandler.openUri("https://men-chat.vercel.app/primeiro-acesso")
                        },
                        enabled = !busy,
                    ) {
                        Text("Primeiro acesso")
                    }
                    TextButton(
                        onClick = {
                            uriHandler.openUri("https://men-chat.vercel.app/primeiro-acesso")
                        },
                        enabled = !busy,
                    ) {
                        Text("Esqueci minha senha")
                    }
                }
            }
        }
    }
}

@Composable
private fun TextPrompt(
    title: String,
    label: String,
    limit: Int,
    code: Boolean,
    close: () -> Unit,
    submit: (String) -> Unit,
) {
    var value by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = close,
        icon = {
            ChatIcon(if (code) Glyph.Chat else Glyph.Group, tint = LocalChatPalette.current.accent)
        },
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (code)
                    Text(
                        "Encontre uma pessoa pelo código de seis letras e números.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                else
                    Text(
                        "Comece com um grupo pessoal.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                OutlinedTextField(
                    value,
                    { input ->
                        value =
                            (if (code) input.filter { it.isLetterOrDigit() }.uppercase() else input)
                                .take(limit)
                    },
                    label = { Text(label) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    keyboardOptions =
                        KeyboardOptions(
                            capitalization =
                                if (code) KeyboardCapitalization.Characters
                                else KeyboardCapitalization.Sentences
                        ),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { submit(value) },
                enabled = if (code) value.matches(Regex("[A-Z0-9]{6}")) else value.isNotBlank(),
            ) {
                Text(if (code) "Conversar" else "Criar grupo")
            }
        },
        dismissButton = { TextButton(onClick = close) { Text("Cancelar") } },
    )
}

@Composable
private fun NativeComposer(
    model: MainModel,
    state: NativeState,
    attach: () -> Unit,
    camera: () -> Unit,
    preview: () -> Unit,
    expressions: () -> Unit,
) {
    val context = LocalContext.current
    var permissionThread by remember { mutableStateOf<String?>(null) }
    val permission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val requested = permissionThread
            permissionThread = null
            if (requested != null && model.state.value.selected?.id == requested) {
                if (granted && model.foreground) model.startRecording()
                else if (!granted)
                    model.error(
                        "Permita o microfone nas configurações do Android para gravar áudio."
                    )
            }
        }
    ComposerContent(
        state,
        model::text,
        { model.reply(null) },
        record = {
            if (
                context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
                    PackageManager.PERMISSION_GRANTED
            )
                model.startRecording()
            else {
                permissionThread = state.selected?.id
                permission.launch(Manifest.permission.RECORD_AUDIO)
            }
        },
        discardRecording = { model.stopRecording(true) },
        discardVoice = model::discardVoice,
        send = model::send,
        sendVoice = model::finishAndSend,
        attach = attach,
        camera = camera,
        discardMedia = model::discardAttachment,
        preview = preview,
        expressions = expressions,
        onSelection = model::cursor,
    )
}
