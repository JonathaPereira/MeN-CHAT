package app.menchat.nativeapp

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.UUID

internal data class NativeBanner(
    val key: String,
    val thread: String,
    val title: String,
    val body: String,
)

internal class NativeNotifications(private val context: Context) {
    private val preferences = NativePreferences(context)
    private val manager = context.getSystemService(NotificationManager::class.java)

    companion object {
        @Volatile var visibleThread: String? = null
        @Volatile var appForeground = false
        val uuid =
            Regex("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")
    }

    fun permitted() =
        Build.VERSION.SDK_INT < 33 ||
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED

    fun channels() {
        for (loud in listOf(true, false)) for (vibrate in listOf(true, false)) {
            val id = channel(loud, vibrate)
            if (manager.getNotificationChannel(id) != null) continue
            val entry =
                NotificationChannel(
                    id,
                    if (loud) "Mensagens MenChat${if(vibrate)" e vibração" else ""}"
                    else "Mensagens silenciosas${if(vibrate)" e vibração" else ""}",
                    NotificationManager.IMPORTANCE_DEFAULT,
                )
            entry.description = "Avisos de mensagens do MenChat"
            entry.enableVibration(vibrate)
            entry.setSound(
                if (loud) soundUri() else null,
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            entry.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            manager.createNotificationChannel(entry)
        }
    }

    fun callChannel(sound: Boolean, vibration: Boolean): String {
        val id = "menchat_calls_v1_${sound}_${vibration}"
        if (manager.getNotificationChannel(id) == null) {
            manager.createNotificationChannel(
                NotificationChannel(id, "Chamadas MenChat", NotificationManager.IMPORTANCE_HIGH)
                    .apply {
                        vibrationPattern = longArrayOf(0, 700, 180, 700, 180, 1000, 500)
                        enableVibration(vibration)
                        setSound(
                            if (sound) soundUri() else null,
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                                .build(),
                        )
                        lockscreenVisibility = Notification.VISIBILITY_PRIVATE
                    }
            )
        }
        return id
    }

    fun channel(sound: Boolean, vibration: Boolean) =
        "menchat_messages_v1_${if(sound)"sound" else "quiet"}_${if(vibration)"vibrate" else "still"}"

    private fun soundUri() =
        Uri.parse("android.resource://${context.packageName}/${R.raw.menchat_ping}")

    fun sound(force: Boolean = false, call: Boolean = false) {
        if (!force) {
            val options = preferences.read(preferences.store.getString("activeActor", null))
            channels()
            val channel =
                manager.getNotificationChannel(
                    if (call) callChannel(options.sound, options.vibration)
                    else channel(options.sound, options.vibration)
                )
            if (
                !manager.areNotificationsEnabled() ||
                    channel?.importance == NotificationManager.IMPORTANCE_NONE ||
                    channel?.sound == null
            )
                return
        }
        val audio = context.getSystemService(AudioManager::class.java)
        if (
            audio.ringerMode != AudioManager.RINGER_MODE_NORMAL ||
                manager.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_NONE
        )
            return
        runCatching {
            RingtoneManager.getRingtone(context, soundUri()).apply {
                audioAttributes =
                    AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build()
                play()
            }
        }
    }

    @Suppress("DEPRECATION")
    fun vibrate(call: Boolean = false) {
        val options = preferences.read(preferences.store.getString("activeActor", null))
        channels()
        val channel =
            manager.getNotificationChannel(
                if (call) callChannel(options.sound, options.vibration)
                else channel(options.sound, options.vibration)
            )
        if (
            !manager.areNotificationsEnabled() ||
                channel?.importance == NotificationManager.IMPORTANCE_NONE ||
                channel?.shouldVibrate() != true
        )
            return
        if (
            context.getSystemService(AudioManager::class.java).ringerMode ==
                AudioManager.RINGER_MODE_SILENT ||
                manager.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_NONE
        )
            return
        val vibrator =
            if (Build.VERSION.SDK_INT >= 31)
                context.getSystemService(VibratorManager::class.java).defaultVibrator
            else context.getSystemService(Vibrator::class.java)
        runCatching {
            if (vibrator.hasVibrator())
                vibrator.vibrate(
                    if (call)
                        VibrationEffect.createWaveform(
                            longArrayOf(0) + LongArray(80) { if (it % 2 == 0) 700L else 350L },
                            -1,
                        )
                    else VibrationEffect.createOneShot(35, VibrationEffect.DEFAULT_AMPLITUDE)
                )
        }
    }

    @Suppress("DEPRECATION")
    fun stopVibration() {
        runCatching {
            val vibrator =
                if (Build.VERSION.SDK_INT >= 31)
                    context.getSystemService(VibratorManager::class.java).defaultVibrator
                else context.getSystemService(Vibrator::class.java)
            vibrator.cancel()
        }
    }

    fun already(thread: String, stamp: String): Boolean {
        val key = "noticed:${preferences.store.getString("activeActor","")}:$thread"
        val normalized =
            stamp.toLongOrNull()
                ?: runCatching { java.time.OffsetDateTime.parse(stamp).toInstant().toEpochMilli() }
                    .getOrNull()
        val stored = preferences.store.getString(key, null)
        if (
            (normalized != null && stored?.toLongOrNull()?.let { it >= normalized } == true) ||
                stored == stamp
        )
            return true
        preferences.store.edit().putString(key, normalized?.toString() ?: stamp).apply()
        return false
    }

    fun show(
        thread: String,
        key: String,
        options: NativeOptions,
        title: String = "MenChat",
        body: String = "Você tem uma nova mensagem.",
        call: String? = null,
    ) {
        if (!permitted() || !NotificationManagerCompat.from(context).areNotificationsEnabled())
            return
        channels()
        val intent =
            Intent(context, NativeActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("thread", thread)
        if (call != null) intent.putExtra("call", call)
        val pending =
            PendingIntent.getActivity(
                context,
                key.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val notification =
            NotificationCompat.Builder(
                    context,
                    if (call == null) channel(options.sound, options.vibration)
                    else callChannel(options.sound, options.vibration),
                )
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(0xFF1B715A.toInt())
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(pending)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setCategory(
                    if (call == null) NotificationCompat.CATEGORY_MESSAGE
                    else NotificationCompat.CATEGORY_CALL
                )
                .setTimeoutAfter(if (call == null) 86_400_000 else 45_000)
                .build()
        if (call != null) notification.flags = notification.flags or Notification.FLAG_INSISTENT
        manager.notify(key, key.hashCode(), notification)
    }

    fun test(options: NativeOptions) {
        show(
            "",
            UUID.randomUUID().toString(),
            options,
            "MenChat",
            "Seu aviso de teste está funcionando.",
        )
    }

    fun clear() {
        manager.cancelAll()
        visibleThread = null
    }

    fun systemSettings(options: NativeOptions) {
        channels()
        context.startActivity(
            Intent(android.provider.Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
                .putExtra(
                    android.provider.Settings.EXTRA_CHANNEL_ID,
                    channel(options.sound, options.vibration),
                )
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }
}
