package app.menchat.nativeapp

import android.content.Context
import java.util.UUID

internal data class NativeOptions(
    val theme: String = "dark",
    val textScale: Float = 1f,
    val notifications: Boolean = true,
    val inApp: Boolean = true,
    val sound: Boolean = true,
    val vibration: Boolean = true,
    val previews: Boolean = false,
    val onlyAway: Boolean = true,
    val muted: Set<String> = emptySet(),
    val dataSaver: Boolean = false,
    val autoImages: Boolean = true,
    val autoAudio: Boolean = true,
    val autoVideo: Boolean = false,
    val enterSends: Boolean = false,
    val playbackRate: Float = 1f,
    val noiseSuppression: Boolean = true,
) {
    fun auto(kind: String) =
        !dataSaver &&
            when (kind) {
                "image" -> autoImages
                "audio" -> autoAudio
                "video" -> autoVideo
                else -> false
            }

    fun notify(thread: String, visible: Boolean) =
        notifications && thread !in muted && (!onlyAway || !visible)
}

internal class NativePreferences(context: Context) {
    val store = context.getSharedPreferences("menchat-native-options", Context.MODE_PRIVATE)
    val installation: String
        get() =
            store.getString("installation", null)
                ?: UUID.randomUUID().toString().also {
                    store.edit().putString("installation", it).commit()
                }

    fun read(actor: String? = null) =
        NativeOptions(
            theme =
                store
                    .getString("theme", if (store.getBoolean("dark", true)) "dark" else "light")!!
                    .takeIf { it in listOf("dark", "light", "system") } ?: "dark",
            textScale =
                store.getFloat("textScale", 1f).takeIf { it in listOf(.9f, 1f, 1.15f) } ?: 1f,
            notifications = store.getBoolean("notifications", true),
            inApp = store.getBoolean("inApp", true),
            sound = store.getBoolean("sound", true),
            vibration = store.getBoolean("vibration", true),
            previews = store.getBoolean("previews", false),
            onlyAway = store.getBoolean("onlyAway", true),
            muted =
                if (actor == null) emptySet()
                else store.getStringSet("muted:$actor", emptySet())!!.toSet(),
            dataSaver = store.getBoolean("dataSaver", false),
            autoImages = store.getBoolean("autoImages", true),
            autoAudio = store.getBoolean("autoAudio", true),
            autoVideo = store.getBoolean("autoVideo", false),
            enterSends = store.getBoolean("enterSends", false),
            playbackRate =
                store.getFloat("playbackRate", 1f).takeIf { it in listOf(1f, 1.25f, 1.5f, 2f) }
                    ?: 1f,
            noiseSuppression = store.getBoolean("noiseSuppression", true),
        )

    fun write(value: NativeOptions, actor: String?) {
        store
            .edit()
            .apply {
                putString("theme", value.theme)
                putFloat("textScale", value.textScale)
                putBoolean("notifications", value.notifications)
                putBoolean("inApp", value.inApp)
                putBoolean("sound", value.sound)
                putBoolean("vibration", value.vibration)
                putBoolean("previews", value.previews)
                putBoolean("onlyAway", value.onlyAway)
                if (actor != null) putStringSet("muted:$actor", value.muted)
                putBoolean("dataSaver", value.dataSaver)
                putBoolean("autoImages", value.autoImages)
                putBoolean("autoAudio", value.autoAudio)
                putBoolean("autoVideo", value.autoVideo)
                putBoolean("enterSends", value.enterSends)
                putFloat("playbackRate", value.playbackRate)
                putBoolean("noiseSuppression", value.noiseSuppression)
            }
            .apply()
    }
}
