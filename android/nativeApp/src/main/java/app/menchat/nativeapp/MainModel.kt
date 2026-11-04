package app.menchat.nativeapp

import android.app.Application
import android.media.MediaRecorder
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
)

internal class MainModel(application: Application, val gateway: Gateway) :
    AndroidViewModel(application) {
    constructor(application: Application) : this(application, Gateway())

    var foreground = false
    var atBottom = true
    var covered = false
    val audio = NativeAudio(application) { error(it) }
    private val vault = SessionVault(application)
    private val mutable = MutableStateFlow(NativeState(restoring = vault.contains()))
    val state = mutable.asStateFlow()
    private var generation = 0L
    private var polling = false
    private var seenSeq = -1L
    private var pendingId = UUID.randomUUID().toString()
    private var upload: PreparedVoice? = null
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
        audio.stop()
        withContext(Dispatchers.IO) {
            try {
                gateway.logout()
            } catch (_: Exception) {} finally {
                vault.clear()
            }
        }
        change { NativeState() }
    }

    fun select(thread: Conversation?) {
        if (state.value.busy) return
        generation++
        audio.stop()
        stopRecording(true)
        state.value.voice?.delete()
        seenSeq = -1
        pendingId = UUID.randomUUID().toString()
        upload = null
        change {
            it.copy(
                selected = thread,
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
            if (latest > seenSeq && foreground && atBottom && !covered) {
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
        if (value.length > 4000) return
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
        pendingId = UUID.randomUUID().toString()
        change { it.copy(reply = message) }
    }

    fun send() = action {
        val s = state.value
        val target = s.selected ?: return@action
        require(target.canSend) { "Você não pode enviar nesta conversa." }
        require(s.text.isNotBlank() || s.voice != null) { "Escreva ou grave um áudio." }
        val saved =
            withContext(Dispatchers.IO) {
                if (s.voice != null) {
                    if (upload == null) upload = gateway.reserveVoice(target.id, s.voice)
                    gateway.uploadVoice(upload!!, s.voice)
                }
                gateway.send(pendingId, target.id, s.text.trim(), upload?.id, s.reply?.id)
            }
        generation++
        s.voice?.delete()
        upload = null
        pendingId = UUID.randomUUID().toString()
        change {
            it.copy(
                text = "",
                voice = null,
                reply = null,
                messages = (it.messages + saved).distinctBy { m -> m.id }.sortedBy { m -> m.seq },
            )
        }
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
        change {
            it.copy(
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
        change {
            it.copy(
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
        state.value.voice?.delete()
        upload = null
        change { it.copy(voice = null) }
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
        super.onCleared()
    }
}
