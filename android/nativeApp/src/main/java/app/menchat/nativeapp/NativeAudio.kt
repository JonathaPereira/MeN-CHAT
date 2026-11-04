package app.menchat.nativeapp

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

internal data class AudioState(
    val id: String? = null,
    val playing: Boolean = false,
    val loading: Boolean = false,
    val elapsed: Int = 0,
    val duration: Int = 0,
)

internal class NativeAudio(context: Context, private val onError: (String) -> Unit) {
    private val manager = context.getSystemService(AudioManager::class.java)
    private val handler = Handler(Looper.getMainLooper())
    private var player: MediaPlayer? = null
    private val mutable = MutableStateFlow(AudioState())
    val state = mutable.asStateFlow()
    private val attributes =
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
    private val focus =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener { if (it < 0) pause() }
            .build()
    private val tick =
        object : Runnable {
            override fun run() {
                try {
                    player?.let {
                        mutable.value =
                            mutable.value.copy(
                                elapsed = it.currentPosition,
                                duration = it.duration.coerceAtLeast(0),
                            )
                    }
                } catch (_: Exception) {}
                if (mutable.value.playing) handler.postDelayed(this, 300)
            }
        }

    fun toggle(id: String, url: String) {
        if (mutable.value.id == id && player != null) {
            if (mutable.value.playing) pause() else start()
            return
        }
        stop()
        mutable.value = AudioState(id = id, loading = true)
        try {
            val acquired = MediaPlayer()
            player = acquired
            acquired.apply {
                setAudioAttributes(attributes)
                setOnPreparedListener {
                    if (this@NativeAudio.player !== it) return@setOnPreparedListener
                    mutable.value =
                        mutable.value.copy(loading = false, duration = it.duration.coerceAtLeast(0))
                    this@NativeAudio.start()
                }
                setOnCompletionListener {
                    if (this@NativeAudio.player !== it) return@setOnCompletionListener
                    mutable.value = mutable.value.copy(playing = false)
                    manager.abandonAudioFocusRequest(focus)
                    handler.removeCallbacks(tick)
                }
                setOnErrorListener { _, _, _ ->
                    this@NativeAudio.stop()
                    onError("Não foi possível reproduzir. Tente novamente.")
                    true
                }
                setDataSource(url)
                prepareAsync()
            }
        } catch (_: Exception) {
            stop()
            onError("Não foi possível reproduzir este áudio.")
        }
    }

    private fun start() {
        try {
            if (manager.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                player?.start()
                mutable.value = mutable.value.copy(playing = true)
                handler.post(tick)
            }
        } catch (_: Exception) {
            stop()
            onError("Áudio indisponível. Tente novamente.")
        }
    }

    fun pause() {
        try {
            player?.pause()
        } catch (_: Exception) {}
        mutable.value = mutable.value.copy(playing = false)
        handler.removeCallbacks(tick)
        manager.abandonAudioFocusRequest(focus)
    }

    fun seek(value: Float) {
        try {
            player?.seekTo(value.toInt())
            mutable.value = mutable.value.copy(elapsed = value.toInt())
        } catch (_: Exception) {}
    }

    fun stop() {
        handler.removeCallbacks(tick)
        val previous = player
        player = null
        previous?.setOnPreparedListener(null)
        previous?.setOnCompletionListener(null)
        previous?.setOnErrorListener(null)
        previous?.release()
        mutable.value = AudioState()
        manager.abandonAudioFocusRequest(focus)
    }
}
