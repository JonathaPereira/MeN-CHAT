package app.menchat.nativeapp

import android.app.Application
import android.media.MediaRecorder
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.File
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal data class NativeState(
    val restoring: Boolean = false,
    val busy: Boolean = false,
    val account: Account? = null,
    val threads: List<Conversation> = emptyList(),
    val selected: Conversation? = null,
    val older: Boolean = false,
    val notice: String? = null,
    val messages: List<Message> = emptyList(),
    val people: List<Person> = emptyList(),
    val text: String = "",
    val voice: File? = null,
    val recording: Boolean = false,
    val seconds: Int = 0,
    val error: String? = null,
    val reply: Message? = null,
    val attachment: LocalAttachment? = null,
    val profile: ProfileDraft? = null,
    val retrySend: Boolean = false,
    val options: NativeOptions = NativeOptions(),
    val callActive: Boolean = false,
    val mentions: Map<String, String> = emptyMap(),
    val starred: Set<String> = emptySet(),
    val favorites: List<Message> = emptyList(),
    val invitations: List<NativeInvitation> = emptyList(),
    val invitationUrl: String? = null,
    val stickerSource: LocalAttachment? = null,
    val stickers: List<NativeSticker> = emptyList(),
    val cursor: Int = 0,
    val banner: NativeBanner? = null,
    val pushReady: Boolean = false,
    val pushStatus: String? = null,
    val callsReady: Boolean = false,
)

internal class MainModel(application: Application, val gateway: Gateway) :
    AndroidViewModel(application) {
    constructor(application: Application) : this(application, Gateway())

    var foreground = false
        set(value) {
            field = value
            NativeNotifications.appForeground = value
            calls.foreground(value)
            publishVisibility()
        }

    var atBottom = true
    var covered = false
    var mediaCovered = false
    var pickerCovered = false
    val audio = NativeAudio(application) { error(it) }
    val notifications = NativeNotifications(application)
    private val nativePush = NativePush(application)
    private val observedInbox = mutableMapOf<String, String?>()
    private var inboxSeeded = false
    private val vault = SessionVault(application)
    val preferences = NativePreferences(application)
    val calls = NativeCalls(application, gateway, preferences)
    private val mutable =
        MutableStateFlow(NativeState(restoring = vault.contains(), options = preferences.read()))
    val state = mutable.asStateFlow()
    private var generation = 0L
    private var polling = false
    private var refreshPending = false
    private var seenSeq = -1L
    private var pendingId = UUID.randomUUID().toString()
    private var upload: PreparedVoice? = null
    private var attempt: SendAttempt? = null
    private var avatarUpload: PreparedVoice? = null
    private var avatarUploaded = false
    private val localMedia = NativeLocalMedia(application)
    private val stickerShelf = NativeStickerShelf(application)

    private data class SendAttempt(
        val actor: String,
        val id: String,
        val thread: String,
        val body: String,
        val reply: String?,
        val mentions: Set<String>,
        val file: LocalAttachment?,
        var prepared: PreparedVoice?,
        var publishing: Boolean = false,
    )

    private var recorder: MediaRecorder? = null
    private var ticker: Job? = null
    private var file: File? = null
    private var typingJob: Job? = null

    private fun change(block: (NativeState) -> NativeState) {
        mutable.value = block(mutable.value)
    }

    init {
        viewModelScope.launch {
            calls.state.collect { value ->
                change { it.copy(callActive = value.busy || value.active != null) }
            }
        }
        gateway.onCredentials = { vault.save(it) }
        if (vault.contains())
            viewModelScope.launch {
                try {
                    val account =
                        withContext(Dispatchers.IO) {
                            gateway.credentials = vault.read() ?: kotlin.error("Entre novamente.")
                            gateway.account()
                        }
                    change {
                        it.copy(
                            account = account,
                            restoring = false,
                            options = preferences.read(account.id),
                            stickers = stickerShelf.list(account.id),
                        )
                    }
                    refresh()
                } catch (_: Exception) {
                    runCatching { vault.clear() }
                    gateway.credentials = null
                    change { NativeState(error = "Entre novamente para continuar.") }
                }
            }
    }

    fun publishVisibility() {
        NativeNotifications.visibleThread =
            state.value.selected?.id?.takeIf {
                foreground && atBottom && !covered && !mediaCovered && !pickerCovered
            }
    }

    fun bottom(value: Boolean) {
        atBottom = value
        publishVisibility()
    }

    private var notificationThread: String? = null

    fun notification(thread: String?, showCall: Boolean = false) {
        if (showCall) calls.expand()
        if (thread != null && NativeNotifications.uuid.matches(thread)) notificationThread = thread
        viewModelScope.launch {
            state.first { !it.restoring && !it.busy }
            if (state.value.account != null) {
                val id = notificationThread
                notificationThread = null
                if (id != null) openBanner(id)
            }
        }
    }

    fun clearError() = change { it.copy(error = null) }

    fun error(message: String) = change { it.copy(error = message) }

    fun login(email: String, password: String) = action {
        try {
            val account = withContext(Dispatchers.IO) { gateway.login(email, password) }
            change {
                it.copy(
                    account = account,
                    options = preferences.read(account.id),
                    stickers = stickerShelf.list(account.id),
                )
            }
            refresh()
        } catch (e: Exception) {
            runCatching { vault.clear() }
            gateway.credentials = null
            throw e
        }
    }

    fun logout() = action {
        calls.logout()
        nativePush.unregister(gateway)
        preferences.store.edit().remove("activeActor").apply()
        observedInbox.clear()
        inboxSeeded = false
        generation++
        stopRecording(true)
        state.value.voice?.delete()
        state.value.attachment?.file?.delete()
        state.value.profile?.photo?.file?.delete()
        audio.stop()
        withContext(Dispatchers.IO) {
            runCatching { upload?.let { gateway.discardFile(it) } }
            runCatching { avatarUpload?.let { gateway.discardFile(it) } }

            try {
                gateway.logout()
            } catch (_: Exception) {} finally {
                vault.clear()
            }
        }
        upload = null
        attempt = null
        avatarUpload = null
        avatarUploaded = false
        change { NativeState(options = preferences.read()) }
    }

    private fun abandon(item: PreparedVoice?) {
        if (item == null) return
        val actor = state.value.account?.id
        viewModelScope.launch {
            try {
                if (state.value.account?.id == actor)
                    withContext(Dispatchers.IO) { gateway.discardFile(item) }
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (_: Exception) {}
        }
    }

    private fun clearFiles() {
        change {
            it.copy(
                mentions = emptyMap(),
                cursor = 0,
                starred = emptySet(),
                favorites = emptyList(),
            )
        }
        state.value.voice?.delete()
        state.value.attachment?.file?.delete()
        abandon(upload)
        upload = null
        attempt = null
        pendingId = UUID.randomUUID().toString()
    }

    fun select(thread: Conversation?) {
        if (state.value.busy) return
        generation++
        audio.stop()
        stopRecording(true)
        clearFiles()
        seenSeq = -1
        pendingId = UUID.randomUUID().toString()
        upload = null
        change {
            it.copy(
                selected = thread,
                attachment = null,
                retrySend = false,
                mentions = emptyMap(),
                cursor = 0,
                starred = emptySet(),
                favorites = emptyList(),
                older = false,
                notice = null,
                messages = emptyList(),
                people = emptyList(),
                text = "",
                voice = null,
                reply = null,
                error = null,
            )
        }
        viewModelScope.launch { refresh() }
    }

    suspend fun refresh() {
        if (state.value.account == null) return
        if (polling) {
            refreshPending = true
            return
        }
        polling = true
        try {
            do {
                refreshPending = false
                refreshOnce()
            } while (refreshPending && state.value.account != null)
        } finally {
            polling = false
        }
    }

    private suspend fun refreshOnce() {
        val epoch = generation
        val actor = state.value.account?.id
        val selectedId = state.value.selected?.id
        fun current() =
            generation == epoch &&
                state.value.account?.id == actor &&
                state.value.selected?.id == selectedId
        val warnings = mutableListOf<String>()
        var stage = SyncStage.LISTA
        try {
            val threads =
                try {
                    withContext(Dispatchers.IO) { gateway.conversations() }
                } catch (cancel: CancellationException) {
                    throw cancel
                } catch (error: Exception) {
                    if (!current()) return
                    warnings += syncIssue(SyncStage.LISTA, error)
                    null
                }
            if (!current()) return
            if (threads != null) {
                notifyInbox(threads, actor)
                change { it.copy(threads = threads) }
            }
            val target = state.value.selected
            if (target == null) {
                change { it.copy(notice = warnings.takeIf { it.isNotEmpty() }?.joinToString("\n")) }
                return
            }
            val updated = if (threads == null) target else threads.find { it.id == target.id }
            if (updated == null) {
                if (!state.value.busy) select(null)
                else {
                    audio.stop()
                    change {
                        it.copy(
                            selected = target.copy(canSend = false),
                            messages = emptyList(),
                            people = emptyList(),
                            reply = null,
                        )
                    }
                }
                return
            }
            stage = SyncStage.HISTORICO
            val previous = state.value.messages
            val rows =
                withContext(Dispatchers.IO) {
                    gateway.messages(target.id, after = previous.lastOrNull()?.seq)
                }
            val messages =
                withContext(Dispatchers.IO) {
                    gateway.reconcile(
                        target.id,
                        (previous + rows).distinctBy { it.id }.sortedBy { it.seq },
                    )
                }
            if (!current()) return
            val previousReply = state.value.reply
            val canonicalReply = previousReply?.let { reply ->
                messages.find { it.id == reply.id }?.takeUnless { it.deleted }
                    ?: if (messages.any { it.id == reply.id }) null
                    else
                        withContext(Dispatchers.IO) {
                            runCatching {
                                gateway.findSent(reply.id, target.id)?.takeUnless { it.deleted }
                            }
                                .getOrNull()
                        }
            }
            if (!current()) return
            // Render authorized history before optional roster/receipt requests.
            change {
                it.copy(
                    selected = updated,
                    reply = if (it.reply?.id == previousReply?.id) canonicalReply else it.reply,
                    messages = messages,
                    notice = null,
                    older = if (previous.isEmpty()) rows.size == 100 else it.older,
                )
            }
            try {
                val people = withContext(Dispatchers.IO) { gateway.people(target.id) }
                if (!current()) return
                change { it.copy(people = people) }
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (error: Exception) {
                if (!current()) return
                // Do not leave a stale typing indicator when the roster cannot refresh.
                change { it.copy(people = emptyList()) }
                warnings += syncIssue(SyncStage.PARTICIPANTES, error)
            }
            if (!current()) return
            val latest = messages.lastOrNull()?.seq ?: 0
            if (
                latest > seenSeq &&
                    foreground &&
                    atBottom &&
                    !covered &&
                    !mediaCovered &&
                    !pickerCovered
            ) {
                try {
                    withContext(Dispatchers.IO) { gateway.seen(target.id, latest) }
                    if (!current()) return
                    seenSeq = latest
                } catch (cancel: CancellationException) {
                    throw cancel
                } catch (error: Exception) {
                    if (!current()) return
                    warnings += syncIssue(SyncStage.LEITURA, error)
                }
            }
            if (current())
                change { it.copy(notice = warnings.takeIf { it.isNotEmpty() }?.joinToString("\n")) }
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (error: Exception) {
            if (!current()) return
            if (
                stage == SyncStage.HISTORICO &&
                    error is NativeApiException &&
                    error.status in listOf(401, 403)
            ) {
                audio.stop()
                change {
                    it.copy(
                        messages = emptyList(),
                        people = emptyList(),
                        reply = null,
                        selected = it.selected?.copy(canSend = false),
                    )
                }
            }
            warnings += syncIssue(stage, error)
            change { it.copy(notice = warnings.joinToString("\n")) }
        }
    }

    fun history() = action {
        val current = state.value
        val target = current.selected ?: return@action
        val before = current.messages.firstOrNull()?.seq ?: return@action
        val rows = withContext(Dispatchers.IO) { gateway.messages(target.id, before = before) }
        if (state.value.selected?.id == target.id) {
            generation++
            change {
                it.copy(
                    messages =
                        (rows + it.messages).distinctBy { m -> m.id }.sortedBy { m -> m.seq },
                    older = rows.size == 100,
                )
            }
        }
    }

    fun text(value: String) {
        if (value.length > 4000 || attempt != null || state.value.busy) return
        if (state.value.text == value) return
        pendingId = UUID.randomUUID().toString()
        change {
            it.copy(
                text = value,
                cursor = value.length,
                mentions = it.mentions.filterValues { label -> value.contains("@$label") },
            )
        }
        typingJob?.cancel()
        typingJob = viewModelScope.launch {
            delay(500)
            val s = state.value
            val target = s.selected ?: return@launch
            try {
                withContext(Dispatchers.IO) {
                    gateway.typing(
                        target.id,
                        s.messages.lastOrNull()?.seq ?: 0,
                        value.isNotBlank(),
                    )
                }
            } catch (_: Exception) {}
        }
    }

    fun reply(message: Message?) {
        if (attempt != null || state.value.busy) return
        pendingId = UUID.randomUUID().toString()
        change { it.copy(reply = message) }
    }

    fun send() = action {
        val state = state.value
        val target = state.selected ?: return@action
        require(target.canSend) { "Você não pode enviar nesta conversa." }
        val actor = state.account?.id ?: return@action
        require(state.text.isNotBlank() || state.attachment != null || state.voice != null) {
            "Escreva ou escolha um anexo."
        }
        val pending =
            attempt
                ?: SendAttempt(
                        actor,
                        pendingId,
                        target.id,
                        if (state.attachment?.sticker == true) "" else state.text.trim(),
                        state.reply?.id,
                        if (state.attachment?.sticker == true) emptySet() else state.mentions.keys,
                        state.attachment
                            ?: state.voice?.let {
                                LocalAttachment(it, it.name, "audio/mp4", "audio")
                            },
                        upload,
                    )
                    .also { attempt = it }
        require(pending.actor == actor && pending.thread == target.id)
        require(pending.body.isNotBlank() || pending.file != null) {
            "Escreva ou escolha um anexo."
        }
        try {
            val saved =
                withContext(Dispatchers.IO) {
                    val confirmed =
                        if (pending.publishing) gateway.findSent(pending.id, pending.thread)
                        else null
                    if (confirmed != null) {
                        require(
                            confirmed.sender == actor &&
                                (confirmed.deleted ||
                                    (confirmed.text == pending.body &&
                                        confirmed.attachment == pending.prepared?.id &&
                                        confirmed.reply == pending.reply &&
                                        confirmed.mentions == pending.mentions))
                        ) {
                            "Não foi possível confirmar esse envio."
                        }
                        confirmed
                    } else {
                        if (!pending.publishing && pending.file != null) {
                            if (pending.prepared == null)
                                pending.prepared =
                                    gateway.reserveFile(target.id, pending.file).also {
                                        upload = it
                                    }
                            gateway.uploadFile(pending.prepared!!, pending.file)
                        }
                        pending.publishing = true
                        gateway.send(
                            pending.id,
                            pending.thread,
                            pending.body,
                            pending.prepared?.id,
                            pending.reply,
                            pending.mentions,
                        )
                    }
                }
            generation++
            viewModelScope.launch {
                withContext(Dispatchers.IO) {
                    runCatching {
                        gateway.mobile(
                            "/api/mobile/push/dispatch",
                            org.json.JSONObject().put("id", saved.id),
                        )
                    }
                }
            }
            pending.file?.file?.delete()
            upload = null
            attempt = null
            pendingId = UUID.randomUUID().toString()
            change {
                it.copy(
                    text = if (pending.file?.sticker == true) it.text else "",
                    mentions = emptyMap(),
                    cursor = if (pending.file?.sticker == true) it.cursor else 0,
                    voice = null,
                    attachment = null,
                    retrySend = false,
                    reply = null,
                    messages =
                        (it.messages + saved).distinctBy { m -> m.id }.sortedBy { m -> m.seq },
                )
            }
            refresh()
        } catch (error: Exception) {
            val rejected =
                error is NativeApiException && error.status in 400..499 && error.status != 408
            if (!pending.publishing || rejected) attempt = null
            change { it.copy(retrySend = attempt != null) }
            throw error
        }
    }

    fun discardAttachment() = action {
        val item = upload
        val wasRetry = state.value.retrySend
        try {
            if (item != null) withContext(Dispatchers.IO) { gateway.discardFile(item) }
        } finally {
            state.value.attachment?.file?.delete()
            state.value.voice?.delete()
            upload = null
            attempt = null
            pendingId = UUID.randomUUID().toString()
            change {
                it.copy(
                    attachment = null,
                    voice = null,
                    retrySend = false,
                    reply = null,
                    text = if (wasRetry) "" else it.text,
                )
            }
        }
    }

    fun beginProfile() {
        if (state.value.busy || state.value.recording) return
        val account = state.value.account ?: return
        change {
            it.copy(
                profile =
                    ProfileDraft(
                        account.name,
                        account.status,
                        account.showCode,
                        account.lookup,
                        account.readReceipts,
                        account.showTyping,
                    )
            )
        }
    }

    fun editProfile(draft: ProfileDraft) {
        if (!state.value.busy) change { it.copy(profile = draft) }
    }

    fun closeProfile() = action {
        try {
            avatarUpload?.let { withContext(Dispatchers.IO) { gateway.discardFile(it) } }
        } finally {
            state.value.profile?.photo?.file?.delete()
            avatarUpload = null
            avatarUploaded = false
            change { it.copy(profile = null) }
        }
    }

    fun removeProfilePhoto() = action {
        try {
            avatarUpload?.let { withContext(Dispatchers.IO) { gateway.discardFile(it) } }
        } finally {
            state.value.profile?.photo?.file?.delete()
            avatarUpload = null
            avatarUploaded = false
            change { it.copy(profile = it.profile?.copy(photo = null, removePhoto = true)) }
        }
    }

    fun saveProfile() = action {
        val actor = state.value.account?.id ?: return@action
        val draft = state.value.profile ?: return@action
        val previous = state.value.account?.avatarPath
        val account =
            withContext(Dispatchers.IO) {
                if (draft.photo != null) {
                    if (avatarUpload == null) avatarUpload = gateway.reserveFile(null, draft.photo)
                    if (!avatarUploaded) {
                        gateway.uploadFile(avatarUpload!!, draft.photo)
                        avatarUploaded = true
                    }
                }
                gateway.saveProfile(draft, avatarUpload?.id)
                gateway.account()
            }
        if (state.value.account?.id != actor) return@action
        draft.photo?.file?.delete()
        avatarUpload = null
        avatarUploaded = false
        change { it.copy(account = account, profile = null) }
        if (previous != null && previous != account.avatarPath) {
            withContext(Dispatchers.IO) { runCatching { gateway.retireAvatar(actor, previous) } }
        }
        refresh()
    }

    fun receiveSelection(
        uri: Uri?,
        actor: String,
        thread: String?,
        profile: Boolean,
        capture: java.io.File? = null,
        video: Boolean = false,
    ) {
        if (uri == null && capture == null) return
        val restored = state.value.restoring
        viewModelScope.launch {
            state.first { !it.restoring }
            if (state.value.account?.id != actor || state.value.busy) {
                capture?.delete()
                return@launch
            }
            if (!profile && state.value.selected?.id != thread) {
                if (restored && state.value.selected == null) {
                    val target =
                        withContext(Dispatchers.IO) {
                            runCatching {
                                gateway.conversations().find { it.id == thread && it.canSend }
                            }
                                .getOrNull()
                        }
                    if (target == null) {
                        capture?.delete()
                        return@launch
                    }
                    select(target)
                } else {
                    capture?.delete()
                    return@launch
                }
            }
            if (profile && state.value.profile == null) beginProfile()
            action {
                var prepared: LocalAttachment? = null
                try {
                    withContext(Dispatchers.IO) {
                        prepared =
                            if (capture != null) localMedia.captured(capture, video, profile)
                            else localMedia.import(uri!!, profile)
                    }
                    require(
                        state.value.account?.id == actor &&
                            (profile ||
                                (state.value.selected?.id == thread &&
                                    state.value.selected?.canSend == true))
                    ) {
                        "A conversa não está mais disponível."
                    }
                    if (profile) {
                        avatarUpload?.let {
                            withContext(Dispatchers.IO) { gateway.discardFile(it) }
                        }
                        state.value.profile?.photo?.file?.delete()
                        avatarUpload = null
                        avatarUploaded = false
                        change {
                            it.copy(
                                profile = it.profile?.copy(photo = prepared, removePhoto = false)
                            )
                        }
                    } else {
                        require(
                            state.value.voice == null && !state.value.recording && attempt == null
                        ) {
                            "Conclua ou descarte o áudio anterior."
                        }
                        state.value.attachment?.file?.delete()
                        abandon(upload)
                        upload = null
                        pendingId = UUID.randomUUID().toString()
                        change { it.copy(attachment = prepared) }
                    }
                    prepared = null
                } finally {
                    prepared?.file?.delete()
                    capture?.delete()
                }
            }
        }
    }

    fun importSticker(uri: Uri, actor: String) = action {
        require(state.value.account?.id == actor) { "Conta indisponível." }
        val item = withContext(Dispatchers.IO) { localMedia.import(uri) }
        if (item.kind != "image") {
            item.file.delete()
            error("Escolha uma imagem para criar a figurinha.")
            return@action
        }
        state.value.stickerSource?.file?.delete()
        change { it.copy(stickerSource = item) }
    }

    fun closeSticker() {
        if (state.value.busy) return
        state.value.stickerSource?.file?.delete()
        change { it.copy(stickerSource = null) }
    }

    fun saveSticker(bitmap: android.graphics.Bitmap, crop: StickerCrop) = action {
        val actor = state.value.account?.id ?: return@action
        withContext(Dispatchers.IO) { stickerShelf.save(actor, bitmap, crop) }
        state.value.stickerSource?.file?.delete()
        change { it.copy(stickerSource = null, stickers = stickerShelf.list(actor)) }
    }

    fun removeSticker(item: NativeSticker) = action {
        val actor = state.value.account?.id ?: return@action
        withContext(Dispatchers.IO) { stickerShelf.remove(actor, item) }
        change { it.copy(stickers = stickerShelf.list(actor)) }
    }

    fun chooseSticker(item: NativeSticker) = action {
        val actor = state.value.account?.id ?: return@action
        require(
            state.value.selected?.canSend == true &&
                state.value.voice == null &&
                !state.value.recording &&
                attempt == null
        ) {
            "Conclua o envio anterior antes de escolher uma figurinha."
        }
        require(stickerShelf.list(actor).any { it.id == item.id }) { "Figurinha indisponível." }
        val copy = localMedia.temp("webp")
        withContext(Dispatchers.IO) {
            item.file.inputStream().use { NativeLocalMedia.copyBounded(it, copy, 100_000) }
        }
        state.value.attachment?.file?.delete()
        abandon(upload)
        upload = null
        pendingId = UUID.randomUUID().toString()
        change {
            it.copy(
                attachment = LocalAttachment(copy, "figurinha.webp", "image/webp", "image", true)
            )
        }
    }

    fun initializeServices() {
        val actor = state.value.account?.id ?: return
        preferences.store.edit().putString("activeActor", actor).apply()
        audio.rate(state.value.options.playbackRate)
        notificationThread?.let { notification(it) }
        viewModelScope.launch {
            try {
                val cfg = withContext(Dispatchers.IO) { gateway.publicConfiguration() }
                if (state.value.account?.id != actor) return@launch
                nativePush.configure(cfg)
                calls.bind(actor, cfg.callsReady)
                if (state.value.account?.id != actor) return@launch
                change {
                    it.copy(
                        pushReady = nativePush.ready,
                        callsReady = cfg.callsReady,
                        pushStatus =
                            if (nativePush.ready) "Ative para receber com o app fechado."
                            else
                                "Notificações com o app fechado ainda não foram ativadas pelo administrador.",
                    )
                }
                nativePush.sync(gateway, actor, state.value.options)
                if (preferences.store.getBoolean("nativePushEnabled", false) && nativePush.ready)
                    change { it.copy(pushStatus = "Dispositivo vinculado às notificações.") }
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (_: Exception) {
                change {
                    it.copy(
                        pushStatus =
                            "Não foi possível vincular as notificações. Tente ativar novamente."
                    )
                }
            }
        }
    }

    private fun pushPreferencesChanged() {
        val actor = state.value.account?.id ?: return
        viewModelScope.launch {
            try {
                nativePush.sync(gateway, actor, state.value.options)
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (_: Exception) {
                change {
                    it.copy(
                        pushStatus =
                            "Não foi possível sincronizar suas opções. Ative novamente para tentar."
                    )
                }
            }
        }
    }

    fun enablePush() = action {
        val actor = state.value.account?.id ?: return@action
        nativePush.enable(gateway, actor, state.value.options)
        change { it.copy(pushStatus = "Dispositivo vinculado às notificações.") }
    }

    private fun notifyInbox(rows: List<Conversation>, actor: String?) {
        val options = state.value.options
        if (inboxSeeded)
            rows
                .filter {
                    it.unread > 0 &&
                        it.lastSender != null &&
                        it.lastSender != actor &&
                        observedInbox.containsKey(it.id) &&
                        observedInbox[it.id] != it.lastAt
                }
                .forEach { thread ->
                    val visible =
                        foreground &&
                            atBottom &&
                            !covered &&
                            !pickerCovered &&
                            !mediaCovered &&
                            state.value.selected?.id == thread.id
                    val stamp = thread.lastAt ?: return@forEach
                    if (
                        options.notify(thread.id, visible) &&
                            !notifications.already(thread.id, stamp)
                    ) {
                        if (foreground) {
                            if (options.sound) notifications.sound()
                            if (options.vibration) notifications.vibrate()
                            if (options.inApp)
                                change {
                                    it.copy(
                                        banner =
                                            NativeBanner(
                                                stamp,
                                                thread.id,
                                                if (options.previews) thread.name else "MenChat",
                                                if (options.previews) thread.preview.take(100)
                                                else "Você tem uma nova mensagem.",
                                            )
                                    )
                                }
                        } else notifications.show(thread.id, stamp, options)
                    }
                }
        rows.forEach { observedInbox[it.id] = it.lastAt }
        inboxSeeded = true
    }

    fun options(value: NativeOptions) {
        preferences.write(value, state.value.account?.id)
        change { it.copy(options = value) }
        audio.rate(value.playbackRate)
        pushPreferencesChanged()
    }

    fun cursor(value: Int) {
        change { it.copy(cursor = value.coerceIn(0, it.text.length)) }
    }

    fun insertEmoji(value: String) {
        val current = state.value
        val at = current.cursor.coerceIn(0, current.text.length)
        text(current.text.take(at) + value + current.text.drop(at))
        cursor(at + value.length)
    }

    fun mention(person: Person) {
        if (
            state.value.selected?.group != true ||
                state.value.retrySend ||
                state.value.busy ||
                state.value.people.none { it.id == person.id }
        )
            return
        val value = "@${person.name} "
        insertEmoji(value)
        change { it.copy(mentions = it.mentions + (person.id to person.name)) }
    }

    fun manageGroup(
        action: String,
        user: String? = null,
        code: String? = null,
        name: String? = null,
    ) = action {
        val target = state.value.selected ?: return@action
        require(target.group)
        withContext(Dispatchers.IO) { gateway.manageGroup(target.id, action, user, code, name) }
        generation++
        if (action == "leave") {
            clearFiles()
            audio.stop()
            change {
                it.copy(
                    selected = null,
                    messages = emptyList(),
                    people = emptyList(),
                    text = "",
                    voice = null,
                    attachment = null,
                    reply = null,
                    mentions = emptyMap(),
                    retrySend = false,
                )
            }
        }
        refresh()
    }

    fun loadStars() {
        val thread = state.value.selected?.id ?: return
        val actor = state.value.account?.id ?: return
        viewModelScope.launch {
            try {
                val ids = withContext(Dispatchers.IO) { gateway.starred(thread) }
                if (state.value.account?.id == actor && state.value.selected?.id == thread)
                    change { it.copy(starred = ids) }
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (_: Exception) {}
        }
    }

    fun star(message: Message) = action {
        val value = message.id !in state.value.starred
        withContext(Dispatchers.IO) { gateway.star(message.id, value) }
        change {
            it.copy(
                starred = if (value) it.starred + message.id else it.starred - message.id,
                favorites =
                    if (value) it.favorites
                    else it.favorites.filterNot { row -> row.id == message.id },
            )
        }
    }

    private var favoritesPolling = false

    fun refreshFavorites() {
        if (favoritesPolling) return
        val actor = state.value.account?.id ?: return
        val thread = state.value.selected?.id ?: return
        favoritesPolling = true
        viewModelScope.launch {
            try {
                val ids = withContext(Dispatchers.IO) { gateway.starred(thread) }
                val rows = withContext(Dispatchers.IO) { gateway.favoriteMessages(thread, ids) }
                if (state.value.account?.id == actor && state.value.selected?.id == thread)
                    change { it.copy(starred = ids, favorites = rows) }
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (_: Exception) {
                if (state.value.account?.id == actor && state.value.selected?.id == thread)
                    change { it.copy(favorites = emptyList()) }
            } finally {
                favoritesPolling = false
            }
        }
    }

    fun loadFavorites() = action {
        val thread = state.value.selected?.id ?: return@action
        val ids = withContext(Dispatchers.IO) { gateway.starred(thread) }
        val rows = withContext(Dispatchers.IO) { gateway.favoriteMessages(thread, ids) }
        change { it.copy(starred = ids, favorites = rows) }
    }

    fun loadInvitations() = action {
        val rows = withContext(Dispatchers.IO) { gateway.invitations() }
        change { it.copy(invitations = rows) }
    }

    fun invite(email: String) = action {
        require(android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()) {
            "Informe um e-mail válido."
        }
        val url = withContext(Dispatchers.IO) { gateway.createInvitation(email.trim()) }
        require(
            url.startsWith("https://men-chat.vercel.app/convite#") ||
                url.startsWith("https://men-chat.vercel.app/convite/#")
        ) {
            "Endereço de convite indisponível."
        }
        val rows = withContext(Dispatchers.IO) { gateway.invitations() }
        change { it.copy(invitationUrl = url, invitations = rows) }
    }

    fun revokeInvite(id: String) = action {
        withContext(Dispatchers.IO) { gateway.revokeInvitation(id) }
        val rows = withContext(Dispatchers.IO) { gateway.invitations() }
        change { it.copy(invitations = rows, invitationUrl = null) }
    }

    fun forgetInvitation() {
        change { it.copy(invitationUrl = null) }
    }

    fun clearBanner() {
        change { it.copy(banner = null) }
    }

    fun openBanner(thread: String) = action {
        val rows = withContext(Dispatchers.IO) { gateway.conversations() }
        val target = rows.find { it.id == thread } ?: kotlin.error("Conversa indisponível.")
        generation++
        clearFiles()
        audio.stop()
        change {
            it.copy(
                threads = rows,
                selected = target,
                messages = emptyList(),
                people = emptyList(),
                text = "",
                voice = null,
                attachment = null,
                reply = null,
                banner = null,
                retrySend = false,
                mentions = emptyMap(),
            )
        }
        seenSeq = -1
        refresh()
    }

    fun open(code: String) = action {
        val id =
            withContext(Dispatchers.IO) {
                gateway.openPrivate(code.filterNot { it.isWhitespace() }.uppercase())
            }
        val threads = withContext(Dispatchers.IO) { gateway.conversations() }
        val target = threads.find { it.id == id } ?: kotlin.error("Conversa indisponível.")
        generation++
        clearFiles()
        audio.stop()
        change {
            it.copy(
                attachment = null,
                voice = null,
                text = "",
                reply = null,
                retrySend = false,
                threads = threads,
                selected = target,
                messages = emptyList(),
                people = emptyList(),
            )
        }
        seenSeq = -1
        refresh()
    }

    fun group(name: String, codes: List<String> = emptyList()) = action {
        val id = withContext(Dispatchers.IO) { gateway.createGroup(name, codes) }
        val threads = withContext(Dispatchers.IO) { gateway.conversations() }
        generation++
        clearFiles()
        audio.stop()
        change {
            it.copy(
                attachment = null,
                voice = null,
                text = "",
                reply = null,
                retrySend = false,
                threads = threads,
                selected = threads.find { c -> c.id == id },
                messages = emptyList(),
                people = emptyList(),
            )
        }
        seenSeq = -1
        refresh()
    }

    fun delete(message: Message, everyone: Boolean) = action {
        withContext(Dispatchers.IO) { gateway.delete(message.id, everyone) }
        generation++
        change {
            it.copy(
                messages =
                    if (everyone)
                        it.messages.map { row ->
                            if (row.id == message.id)
                                row.copy(
                                    text = "Mensagem apagada.",
                                    attachment = null,
                                    deleted = true,
                                    reply = null,
                                )
                            else row
                        }
                    else it.messages.filter { row -> row.id != message.id }
            )
        }
        refresh()
    }

    private fun action(block: suspend () -> Unit) {
        if (state.value.busy) return
        viewModelScope.launch {
            change { it.copy(busy = true, error = null) }
            try {
                block()
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (e: Exception) {
                error(
                    when (e) {
                        is java.io.IOException ->
                            "Não foi possível conectar. Confira a internet e tente novamente."
                        is org.json.JSONException ->
                            "A resposta do servidor não pôde ser lida. Tente novamente."
                        is java.security.GeneralSecurityException ->
                            "Não foi possível proteger a sessão neste dispositivo."
                        else -> e.message ?: "Não foi possível concluir."
                    }
                )
            } finally {
                change { it.copy(busy = false) }
            }
        }
    }

    @Suppress("DEPRECATION")
    fun startRecording() {
        if (
            state.value.recording ||
                (calls.state.value.active != null || calls.state.value.busy) ||
                state.value.busy ||
                state.value.voice != null ||
                state.value.attachment != null ||
                attempt != null ||
                state.value.selected?.canSend != true
        )
            return
        try {
            audio.stop()
            val output =
                File(getApplication<Application>().cacheDir, "audio-${UUID.randomUUID()}.m4a")
            file = output
            val acquired = MediaRecorder()
            recorder = acquired
            acquired.apply {
                setAudioSource(
                    if (state.value.options.noiseSuppression)
                        MediaRecorder.AudioSource.VOICE_COMMUNICATION
                    else MediaRecorder.AudioSource.MIC
                )
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(64000)
                setAudioSamplingRate(44100)
                setMaxFileSize(10_000_000)
                setMaxDuration(120_000)
                setOutputFile(output.absolutePath)
                setOnErrorListener { _, _, _ ->
                    stopRecording(true)
                    error("A gravação foi interrompida. Tente novamente.")
                }
                setOnInfoListener { _, what, _ ->
                    if (
                        what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED ||
                            what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED
                    )
                        stopRecording(false)
                }
                prepare()
                start()
            }
            change { it.copy(recording = true, seconds = 0, voice = null) }
            ticker = viewModelScope.launch {
                while (true) {
                    delay(1000)
                    change { it.copy(seconds = it.seconds + 1) }
                }
            }
        } catch (_: Exception) {
            stopRecording(true)
            file?.delete()
            file = null
            error("Não foi possível gravar. Confira a permissão do microfone.")
        }
    }

    fun stopRecording(discard: Boolean) {
        val r = recorder ?: return
        var valid = true
        try {
            r.stop()
        } catch (_: Exception) {
            valid = false
        } finally {
            try {
                r.release()
            } catch (_: Exception) {}
            recorder = null
            ticker?.cancel()
        }
        val value = file
        file = null
        if (discard || !valid || value == null || value.length() == 0L) {
            value?.delete()
            change { it.copy(recording = false) }
        } else {
            pendingId = UUID.randomUUID().toString()
            change { it.copy(recording = false, voice = value) }
        }
    }

    fun finishAndSend() {
        stopRecording(false)
        if (state.value.voice != null) send()
    }

    fun discardVoice() {
        if (state.value.recording) stopRecording(true)
        discardAttachment()
    }

    fun onBackground() {
        foreground = false
        NativeNotifications.visibleThread = null
        audio.stop()
        if (state.value.recording) {
            stopRecording(true)
            error("A gravação foi cancelada ao sair do aplicativo.")
        }
    }

    override fun onCleared() {
        calls.close()
        audio.stop()
        stopRecording(true)
        state.value.voice?.delete()
        state.value.attachment?.file?.delete()
        state.value.profile?.photo?.file?.delete()
        super.onCleared()
    }
}
