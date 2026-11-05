package app.menchat.nativeapp

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/** Started only by a visible, permission-granted user action. No camera/mic start from FCM. */
class NativeCallService : Service() {
    private var wake: PowerManager.WakeLock? = null

    companion object {
        private var hangup: (() -> Unit)? = null

        fun start(context: Context, video: Boolean, end: () -> Unit) {
            hangup = end
            ContextCompat.startForegroundService(
                context,
                Intent(context, NativeCallService::class.java).putExtra("video", video),
            )
        }

        fun stop(context: Context) {
            hangup = null
            context.stopService(Intent(context, NativeCallService::class.java))
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "end") {
            hangup?.invoke()
            stopSelf()
            return START_NOT_STICKY
        }
        if (hangup == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel("menchat_active_call") == null)
            manager.createNotificationChannel(
                NotificationChannel(
                        "menchat_active_call",
                        "Chamada em andamento",
                        NotificationManager.IMPORTANCE_LOW,
                    )
                    .apply { setSound(null, null) }
            )
        val open =
            PendingIntent.getActivity(
                this,
                901,
                Intent(this, NativeActivity::class.java)
                    .putExtra("show_call", true)
                    .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val end =
            PendingIntent.getService(
                this,
                902,
                Intent(this, NativeCallService::class.java).setAction("end"),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val notification =
            NotificationCompat.Builder(this, "menchat_active_call")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("MenChat · chamada em andamento")
                .setContentText("Toque para voltar à chamada.")
                .setContentIntent(open)
                .setOngoing(true)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .addAction(R.drawable.ic_notification, "Encerrar", end)
                .build()
        val type =
            if (Build.VERSION.SDK_INT >= 30)
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                    (if (intent?.getBooleanExtra("video", false) == true)
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                    else 0)
            else 0
        ServiceCompat.startForeground(this, 900, notification, type)
        if (wake == null) {
            wake =
                getSystemService(PowerManager::class.java)
                    .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MenChat:Call")
                    .apply { acquire(2 * 60 * 60 * 1000L) }
        }
        return START_NOT_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        hangup?.invoke()
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        wake?.let { if (it.isHeld) it.release() }
        wake = null
        super.onDestroy()
    }
}
