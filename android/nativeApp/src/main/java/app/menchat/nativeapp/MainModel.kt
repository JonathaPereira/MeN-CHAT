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
)

internal class MainModel(application: Application, val gateway: Gateway) :
    AndroidViewModel(application) {
    constructor(application: Application) : this(application, Gateway())

    var foreground = false
    var atBottom = true
    var covered = false
    var mediaCovered = false
    var pickerCovered = false
    val audio = NativeAudio(application) { error(it) }
    private val vault = SessionVault(application)
    private val mutable = MutableStateFlow(NativeState(restoring = vault.contains()))
    val state = mutable.asStateFlow()
    private var generation = 0L
    private var polling = false
    private var seenSeq = -1L
    private var pendingId = UUID.randomUUID().toString()
    private var upload: PreparedVoice? = null
    private var attempt: SendAttempt? = null
    private var avatarUpload: PreparedVoice? = null
    private var avatarUploaded = false
    private val localMedia = NativeLocalMedia(application)

    private data class SendAttempt(
        val actor: String,
        val id: String,
        val thread: String,
        val body: String,
        val reply: String?,
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
        gateway.onCredentials = { vault.save(it) }
        if (vault.contains())
            viewModelScope.launch {
                try {
                    val account =
                        withContext(Dispatchers.IO) {
                            gateway.credentials = vault.read() ?: kotlin.error("Entre novamente.")
                            gateway.account()
                        }
                    change { it.copy(account = account, restoring = false) }
                    refresh()
                } catch (_: Exception) {
                    runCatching { vault.clear() }
                    gateway.credentials = null
                    change { NativeState(error = "Entre novamente para continuar.") }
                }
            }
    }

    fun clearError() = change { it.copy(error = null) }

    fun error(message: String) = change { it.copy(error = message) }

    fun login(email: String, password: String) = action {
        try {
            val account = withContext(Dispatchers.IO) { gateway.login(email, password) }
            change { it.copy(account = account) }
            refresh()
        } catch (e: Exception) {
            runCatching { vault.clear() }
            gateway.credentials = null
            throw e
        }
    }

    fun logout() = action {
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
        change { NativeState() }
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
        if (polling || state.value.account == null) return
        polling = true
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
            if (threads != null) change { it.copy(threads = threads) }
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
            // Render authorized history before optional roster/receipt requests.
            change {
                it.copy(
                    selected = updated,
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
        } finally {
            polling = false
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
        change { it.copy(text = value) }
        typingJob?.cancel()
        typingJob =
            viewModelScope.launch {
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
                        state.text.trim(),
                        state.reply?.id,
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
                                        confirmed.reply == pending.reply))
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
                        )
                    }
                }
            generation++
            pending.file?.file?.delete()
            upload = null
            attempt = null
            pendingId = UUID.randomUUID().toString()
            change {
                it.copy(
                    text = "",
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

    fun group(name: String) = action {
        val id = withContext(Dispatchers.IO) { gateway.createGroup(name) }
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
                setAudioSource(MediaRecorder.AudioSource.MIC)
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
            ticker =
                viewModelScope.launch {
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
        audio.stop()
        if (state.value.recording) {
            stopRecording(true)
            error("A gravação foi cancelada ao sair do aplicativo.")
        }
    }

    override fun onCleared() {
        audio.stop()
        stopRecording(true)
        state.value.voice?.delete()
        state.value.attachment?.file?.delete()
        state.value.profile?.photo?.file?.delete()
        super.onCleared()
    }
}
