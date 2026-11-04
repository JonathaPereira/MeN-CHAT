@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.menchat.nativeapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val Dark =
    darkColorScheme(
        primary = Color(0xFFA4D689),
        onPrimary = Color(0xFF123B2D),
        background = Color(0xFF0E1714),
        surface = Color(0xFF14241E),
        surfaceVariant = Color(0xFF243D2D),
        secondaryContainer = Color(0xFF294A37),
    )
private val Light =
    lightColorScheme(
        primary = Color(0xFF196B50),
        background = Color(0xFFECF2E8),
        surface = Color.White,
        secondaryContainer = Color(0xFFDCEED0),
    )

@Composable
internal fun MenChatNative(model: MainModel) {
    val context = LocalContext.current
    val prefs = remember {
        context.getSharedPreferences("menchat-native-options", Context.MODE_PRIVATE)
    }
    var dark by remember { mutableStateOf(prefs.getBoolean("dark", true)) }
    val state by model.state.collectAsState()
    val owner = LocalLifecycleOwner.current
    var settings by remember { mutableStateOf(false) }
    var newConversation by remember { mutableStateOf(false) }
    var createGroup by remember { mutableStateOf(false) }
    var actionMessage by remember { mutableStateOf<Message?>(null) }
    SideEffect {
        model.covered =
            settings ||
                newConversation ||
                createGroup ||
                actionMessage != null ||
                state.error != null
    }
    LaunchedEffect(owner, state.account?.id) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                model.refresh()
                delay(if (model.state.value.selected == null) 5000 else 3000)
            }
        }
    }
    BackHandler(state.selected != null && !state.busy) { model.select(null) }
    MaterialTheme(colorScheme = if (dark) Dark else Light) {
        Surface(Modifier.fillMaxSize()) {
            when {
                state.restoring ->
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Brand()
                            Spacer(Modifier.height(20.dp))
                            CircularProgressIndicator()
                        }
                    }
                state.account == null -> Login(state.busy, model::login)
                else ->
                    Scaffold(
                        topBar = {
                            TopAppBar(
                                title = {
                                    Column {
                                        Text(
                                            state.selected?.name ?: "MenChat",
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            fontWeight = FontWeight.Bold,
                                        )
                                        if (state.selected != null)
                                            Text(
                                                if (state.selected!!.group)
                                                    "${state.people.size} participantes"
                                                else
                                                    state.people
                                                        .firstOrNull { it.id != state.account!!.id }
                                                        ?.name ?: "Conversa privada",
                                                style = MaterialTheme.typography.labelSmall,
                                            )
                                    }
                                },
                                navigationIcon = {
                                    if (state.selected != null)
                                        IconButton(
                                            onClick = { model.select(null) },
                                            enabled = !state.busy,
                                        ) {
                                            Icon(
                                                Icons.AutoMirrored.Filled.ArrowBack,
                                                "Voltar às conversas",
                                            )
                                        }
                                },
                                actions = {
                                    if (state.selected == null)
                                        IconButton(
                                            onClick = { newConversation = true },
                                            enabled = !state.busy,
                                        ) {
                                            Icon(Icons.Default.Add, "Nova conversa")
                                        }
                                    IconButton(
                                        onClick = { settings = true },
                                        enabled = !state.recording && !state.busy,
                                    ) {
                                        Icon(Icons.Default.Settings, "Configurações")
                                    }
                                },
                            )
                        },
                        bottomBar = { if (state.selected != null) NativeComposer(model, state) },
                    ) { padding ->
                        if (state.selected == null) {
                            LazyColumn(
                                Modifier.fillMaxSize().padding(padding),
                                contentPadding = PaddingValues(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                if (state.threads.isEmpty())
                                    item {
                                        Text(
                                            "Inicie uma conversa pelo código de um contato ou crie um grupo.",
                                            Modifier.padding(16.dp),
                                        )
                                    }
                                items(state.threads, key = { it.id }) { thread ->
                                    Card(
                                        onClick = { model.select(thread) },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(18.dp),
                                    ) {
                                        Row(
                                            Modifier.fillMaxWidth().padding(16.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                        ) {
                                            Surface(
                                                shape = RoundedCornerShape(16.dp),
                                                color = MaterialTheme.colorScheme.secondaryContainer,
                                            ) {
                                                Text(
                                                    thread.name.take(2).uppercase(),
                                                    Modifier.padding(13.dp),
                                                    fontWeight = FontWeight.Bold,
                                                )
                                            }
                                            Spacer(Modifier.width(12.dp))
                                            Column(Modifier.weight(1f)) {
                                                Text(
                                                    thread.name,
                                                    fontWeight = FontWeight.SemiBold,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis,
                                                )
                                                Text(
                                                    thread.preview,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis,
                                                    style = MaterialTheme.typography.bodySmall,
                                                )
                                            }
                                            if (thread.unread > 0)
                                                Badge {
                                                    Text(
                                                        if (thread.unread > 99) "99+"
                                                        else thread.unread.toString()
                                                    )
                                                }
                                        }
                                    }
                                }
                                item {
                                    OutlinedButton(
                                        onClick = { createGroup = true },
                                        modifier = Modifier.fillMaxWidth(),
                                    ) {
                                        Text("Criar grupo pessoal")
                                    }
                                }
                            }
                        } else
                            NativeMessages(model, state, Modifier.padding(padding), actionMessage) {
                                actionMessage = it
                            }
                    }
            }
            if (state.notice != null)
                Surface(
                    Modifier.fillMaxWidth().statusBarsPadding(),
                    color = MaterialTheme.colorScheme.errorContainer,
                ) {
                    Text(
                        state.notice!!,
                        Modifier.padding(8.dp),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth().statusBarsPadding())
            if (state.error != null)
                AlertDialog(
                    onDismissRequest = model::clearError,
                    title = { Text("Atenção") },
                    text = { Text(state.error!!) },
                    confirmButton = { TextButton(onClick = model::clearError) { Text("Entendi") } },
                )
            if (newConversation)
                TextPrompt(
                    "Nova conversa",
                    "Código de seis letras/números",
                    { newConversation = false },
                ) {
                    newConversation = false
                    model.open(it)
                }
            if (createGroup)
                TextPrompt("Criar grupo pessoal", "Nome do grupo", { createGroup = false }) {
                    createGroup = false
                    model.group(it)
                }
            if (settings && state.account != null)
                AlertDialog(
                    onDismissRequest = { settings = false },
                    title = { Text("Minha conta") },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(state.account!!.name, fontWeight = FontWeight.Bold)
                            Text("Seu código: ${state.account!!.code}")
                            if (state.account!!.status.isNotBlank()) Text(state.account!!.status)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Modo escuro", Modifier.weight(1f))
                                Switch(
                                    dark,
                                    {
                                        dark = it
                                        prefs.edit().putBoolean("dark", it).apply()
                                    },
                                )
                            }
                            Text(
                                "Os avisos de novas mensagens dependem de o aplicativo estar aberto.",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    },
                    confirmButton = {
                        TextButton(onClick = { settings = false }) { Text("Fechar") }
                    },
                    dismissButton = {
                        TextButton(
                            onClick = {
                                settings = false
                                model.logout()
                            }
                        ) {
                            Text("Sair da conta")
                        }
                    },
                )
        }
    }
}

@Composable
private fun Brand() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Image(painterResource(R.mipmap.ic_launcher), "Logo MenChat", Modifier.size(64.dp))
        Text(
            "MenChat",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun Login(busy: Boolean, onLogin: (String, String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
        Column(
            Modifier.fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .heightIn(min = maxHeight)
                .padding(28.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Brand()
            Spacer(Modifier.height(36.dp))
            OutlinedTextField(
                email,
                { email = it },
                label = { Text("E-mail") },
                singleLine = true,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions =
                    KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                password,
                { password = it },
                label = { Text("Senha") },
                singleLine = true,
                enabled = !busy,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions =
                    KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done,
                    ),
                keyboardActions = KeyboardActions(onDone = { if (!busy) onLogin(email, password) }),
            )
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = { onLogin(email, password) },
                enabled = !busy && email.isNotBlank() && password.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) {
                Text(if (busy) "Entrando…" else "Entrar")
            }
            Spacer(Modifier.height(14.dp))
            Text(
                "Acesso exclusivo para contas convidadas e já ativadas.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun TextPrompt(title: String, label: String, close: () -> Unit, submit: (String) -> Unit) {
    var value by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = close,
        title = { Text(title) },
        text = {
            OutlinedTextField(value, { value = it }, label = { Text(label) }, singleLine = true)
        },
        confirmButton = {
            TextButton(onClick = { submit(value) }, enabled = value.isNotBlank()) {
                Text("Continuar")
            }
        },
        dismissButton = { TextButton(onClick = close) { Text("Cancelar") } },
    )
}

@Composable
private fun NativeMessages(
    model: MainModel,
    state: NativeState,
    modifier: Modifier,
    menuMessage: Message?,
    actions: (Message?) -> Unit,
) {
    val list = rememberLazyListState()
    LaunchedEffect(list) {
        snapshotFlow { list.firstVisibleItemIndex == 0 }.collect { model.atBottom = it }
    }
    LazyColumn(
        modifier.fillMaxSize(),
        state = list,
        reverseLayout = true,
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        val typists = state.people.filter { it.id != state.account!!.id && it.typing }
        if (typists.isNotEmpty())
            item {
                Text(
                    "● ${typists.joinToString { it.name.substringBefore(' ') }} ${if (typists.size == 1) "está digitando" else "estão digitando"}…",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(8.dp),
                )
            }
        items(state.messages.asReversed(), key = { it.id }) { msg ->
            val mine = msg.sender == state.account!!.id
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
            ) {
                Surface(
                    color =
                        if (mine) MaterialTheme.colorScheme.secondaryContainer
                        else MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.widthIn(max = 310.dp),
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                if (mine) "Você"
                                else
                                    state.people.find { it.id == msg.sender }?.name
                                        ?: "Participante",
                                Modifier.weight(1f),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Box {
                                TextButton(
                                    onClick = { actions(msg) },
                                    enabled = !state.busy,
                                    contentPadding = PaddingValues(0.dp),
                                    modifier =
                                        Modifier.size(36.dp).semantics {
                                            contentDescription = "Opções da mensagem"
                                        },
                                ) {
                                    Text("⌄")
                                }
                                DropdownMenu(
                                    expanded = menuMessage?.id == msg.id,
                                    onDismissRequest = { actions(null) },
                                ) {
                                    if (!msg.deleted)
                                        DropdownMenuItem(
                                            text = { Text("Responder") },
                                            onClick = {
                                                model.reply(msg)
                                                actions(null)
                                            },
                                        )
                                    DropdownMenuItem(
                                        text = { Text("Apagar para mim") },
                                        onClick = {
                                            model.delete(msg, false)
                                            actions(null)
                                        },
                                    )
                                    if (mine && !msg.deleted)
                                        DropdownMenuItem(
                                            text = { Text("Apagar para todos") },
                                            onClick = {
                                                model.delete(msg, true)
                                                actions(null)
                                            },
                                        )
                                }
                            }
                        }
                        if (msg.reply != null && !msg.deleted) {
                            val original = state.messages.find { it.id == msg.reply && !it.deleted }
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = MaterialTheme.colorScheme.surface.copy(alpha = .5f),
                            ) {
                                Text(
                                    original?.text?.takeIf { it.isNotBlank() }?.take(180)
                                        ?: if (original?.attachment != null) "Áudio ou anexo"
                                        else "Mensagem indisponível",
                                    Modifier.padding(8.dp),
                                    style = MaterialTheme.typography.bodySmall,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                            Spacer(Modifier.height(8.dp))
                        }
                        if (msg.attachment != null && !msg.deleted)
                            NativeMedia(model, msg.attachment)
                        if (msg.text.isNotBlank()) Text(msg.text)
                        val viewed =
                            state.people
                                .filter { it.id != state.account.id }
                                .let {
                                    it.isNotEmpty() &&
                                        it.all { p -> p.read != null && p.read >= msg.seq }
                                }
                        Text(
                            nativeTime(msg.created) +
                                if (mine) if (viewed) "  ✓✓" else "  ✓" else "",
                            modifier = Modifier.align(Alignment.End).padding(top = 5.dp),
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
            }
        }
        if (state.older)
            item {
                TextButton(
                    onClick = model::history,
                    enabled = !state.busy,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Carregar mensagens anteriores")
                }
            }
    }
}

@Composable
private fun NativeComposer(model: MainModel, state: NativeState) {
    val context = LocalContext.current
    val focus = remember { FocusRequester() }
    val permission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
            if (it) model.startRecording()
            else model.error("Permita o microfone nas configurações do Android para gravar áudio.")
        }
    LaunchedEffect(state.reply?.id) { if (state.reply != null) focus.requestFocus() }
    Surface(tonalElevation = 4.dp) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().imePadding().padding(10.dp)) {
            if (state.reply != null)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Respondendo: ${state.reply.text.take(70).ifBlank { "Áudio ou anexo" }}",
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                    )
                    IconButton(onClick = { model.reply(null) }) {
                        Icon(Icons.Default.Close, "Cancelar resposta")
                    }
                }
            if (state.recording)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "● Gravando ${state.seconds / 60}:${(state.seconds % 60).toString().padStart(2, '0')}",
                        Modifier.weight(1f),
                    )
                    IconButton(onClick = { model.stopRecording(true) }) {
                        Icon(Icons.Default.Delete, "Descartar áudio")
                    }
                    FilledIconButton(onClick = model::finishAndSend) {
                        Icon(Icons.AutoMirrored.Filled.Send, "Enviar áudio")
                    }
                }
            else {
                if (state.voice != null)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "Áudio pronto para enviar",
                            Modifier.weight(1f),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        IconButton(onClick = model::discardVoice) {
                            Icon(Icons.Default.Close, "Remover áudio")
                        }
                    }
                Row(verticalAlignment = Alignment.Bottom) {
                    OutlinedTextField(
                        state.text,
                        model::text,
                        modifier = Modifier.weight(1f).focusRequester(focus),
                        placeholder = { Text("Mensagem…") },
                        enabled = !state.busy && state.selected?.canSend == true,
                        maxLines = 4,
                        shape = RoundedCornerShape(22.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    if (state.voice == null)
                        IconButton(
                            modifier = Modifier.semantics { contentDescription = "Gravar áudio" },
                            onClick = {
                                if (
                                    context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
                                        PackageManager.PERMISSION_GRANTED
                                )
                                    model.startRecording()
                                else permission.launch(Manifest.permission.RECORD_AUDIO)
                            },
                            enabled = !state.busy && state.selected?.canSend == true,
                        ) {
                            Text("🎙", style = MaterialTheme.typography.headlineSmall)
                        }
                    FilledIconButton(
                        onClick = model::send,
                        enabled =
                            !state.busy &&
                                state.selected?.canSend == true &&
                                (state.text.isNotBlank() || state.voice != null),
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, "Enviar mensagem")
                    }
                }
            }
        }
    }
}

@Composable
private fun NativeMedia(model: MainModel, id: String) {
    var media by remember(id) { mutableStateOf<Media?>(null) }
    var url by remember(id) { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val audio by model.audio.state.collectAsState()
    val save =
        rememberLauncherForActivityResult(
            ActivityResultContracts.CreateDocument("application/octet-stream")
        ) { target ->
            val item = media
            if (target != null && item != null)
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) {
                            val source = model.gateway.signed(item)
                            URL(source)
                                .openConnection()
                                .apply {
                                    connectTimeout = 20000
                                    readTimeout = 20000
                                }
                                .getInputStream()
                                .use { input ->
                                    context.contentResolver.openOutputStream(target)?.use { output
                                        ->
                                        input.copyTo(output)
                                    }
                                }
                        }
                    } catch (_: Exception) {
                        model.error("Não foi possível salvar o anexo.")
                    }
                }
        }
    LaunchedEffect(id) {
        try {
            withContext(Dispatchers.IO) { model.gateway.media(id) }
                .also {
                    media = it
                    if (it.kind == "image")
                        url = withContext(Dispatchers.IO) { model.gateway.signed(it) }
                }
        } catch (_: Exception) {
            model.error("Anexo indisponível.")
        }
    }
    val item = media
    if (item == null) {
        Text("Carregando anexo…", style = MaterialTheme.typography.bodySmall)
        return
    }
    if (item.kind == "image" && url != null)
        AsyncImage(
            model =
                ImageRequest.Builder(context)
                    .data(url)
                    .diskCachePolicy(CachePolicy.DISABLED)
                    .build(),
            contentDescription = "Foto enviada",
            modifier = Modifier.fillMaxWidth().heightIn(max = 250.dp),
        )
    if (item.kind == "audio") {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(
                enabled = !(audio.id == id && audio.loading),
                onClick = {
                    scope.launch {
                        try {
                            val source = withContext(Dispatchers.IO) { model.gateway.signed(item) }
                            model.audio.toggle(id, source)
                        } catch (_: Exception) {
                            model.error("Áudio indisponível.")
                        }
                    }
                },
            ) {
                Text(
                    if (audio.id == id && audio.loading) "…"
                    else if (audio.id == id && audio.playing) "Ⅱ" else "▶"
                )
            }
            Column(Modifier.weight(1f)) {
                val active = audio.id == id
                Slider(
                    value =
                        if (active) audio.elapsed.toFloat().coerceAtMost(audio.duration.toFloat())
                        else 0f,
                    onValueChange = model.audio::seek,
                    valueRange =
                        0f..(if (active) audio.duration.coerceAtLeast(1).toFloat() else 1f),
                    enabled = active && audio.duration > 0,
                )
                Text(
                    if (active)
                        "${audio.elapsed / 60000}:${(audio.elapsed / 1000 % 60).toString().padStart(2, '0')}"
                    else "Áudio",
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    } else if (item.kind != "image")
        Text(
            if (item.kind == "video") "Vídeo" else item.name,
            maxLines = 2,
            style = MaterialTheme.typography.bodySmall,
        )
    TextButton(onClick = { save.launch(item.name) }) { Text("↓ Baixar") }
}
