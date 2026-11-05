package app.menchat.nativeapp

import android.app.Application
import android.content.Context
import androidx.work.*
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.installations.FirebaseInstallations
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

internal data class FirebaseRuntime(
    val appId: String,
    val project: String,
    val sender: String,
    val apiKey: String,
) {
    fun json() =
        JSONObject()
            .put("appId", appId)
            .put("projectId", project)
            .put("senderId", sender)
            .put("apiKey", apiKey)

    companion object {
        fun parse(data: JSONObject?): FirebaseRuntime? {
            if (data == null) return null
            val id = data.optString("appId")
            val project = data.optString("projectId")
            val sender = data.optString("senderId")
            val key = data.optString("apiKey")
            if (
                !Regex("1:[0-9]+:android:[a-fA-F0-9]+").matches(id) ||
                    !Regex("[a-z][a-z0-9-]{4,61}[a-z0-9]").matches(project) ||
                    !Regex("[0-9]{5,20}").matches(sender) ||
                    !Regex("AIza[A-Za-z0-9_-]{35}").matches(key)
            )
                return null
            if (id.substringAfter("1:").substringBefore(':') != sender) return null
            return FirebaseRuntime(id, project, sender, key)
        }
    }
}

class NativeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        NativePush.restore(this)
    }
}

internal class NativePush(private val context: Context) {
    private val preferences = NativePreferences(context)
    private val notifications = NativeNotifications(context)
    private var signature: String? = null
    var ready = false
        private set

    companion object {
        fun restore(context: Context) {
            val stored =
                NativePreferences(context).store.getString("firebasePublic", null) ?: return
            val config =
                runCatching { FirebaseRuntime.parse(JSONObject(stored)) }.getOrNull() ?: return
            initialize(context, config)
        }

        @Synchronized
        private fun initialize(context: Context, config: FirebaseRuntime): FirebaseApp? =
            runCatching {
                val previous =
                    FirebaseApp.getApps(context).firstOrNull {
                        it.name == FirebaseApp.DEFAULT_APP_NAME
                    }
                if (previous != null && previous.options.applicationId == config.appId)
                    return@runCatching previous
                previous?.delete()
                FirebaseApp.initializeApp(
                    context,
                    FirebaseOptions.Builder()
                        .setApplicationId(config.appId)
                        .setProjectId(config.project)
                        .setGcmSenderId(config.sender)
                        .setApiKey(config.apiKey)
                        .build(),
                )
            }
            .getOrNull()
    }

    fun configure(config: PublicConfig) {
        ready = config.nativePushReady && config.firebase != null
        config.firebase?.let {
            preferences.store.edit().putString("firebasePublic", it.json().toString()).apply()
            initialize(context, it)
        }
    }

    suspend fun enable(gateway: Gateway, actor: String, options: NativeOptions) {
        check(ready) {
            "As notificações com o app fechado ainda não foram ativadas pelo administrador."
        }
        check(notifications.permitted()) { "Permita as notificações nas configurações do Android." }
        preferences.store.edit().putBoolean("nativePushEnabled", true).apply()
        FirebaseMessaging.getInstance().isAutoInitEnabled = true
        sync(gateway, actor, options, true)
    }

    suspend fun sync(
        gateway: Gateway,
        actor: String,
        options: NativeOptions,
        force: Boolean = false,
    ) {
        if (!ready || !preferences.store.getBoolean("nativePushEnabled", false)) return
        FirebaseMessaging.getInstance().isAutoInitEnabled = true
        val token =
            withContext(Dispatchers.IO) {
                com.google.android.gms.tasks.Tasks.await(
                    FirebaseMessaging.getInstance().register(),
                    20,
                    TimeUnit.SECONDS,
                )
                com.google.android.gms.tasks.Tasks.await(
                    FirebaseInstallations.getInstance().id,
                    20,
                    TimeUnit.SECONDS,
                )
            }
        val stamp =
            actor +
                token +
                options.notifications +
                notifications.permitted() +
                options.muted.sorted().joinToString()
        if (!force && stamp == signature) return
        withContext(Dispatchers.IO) {
            gateway.rpc(
                "menchat_register_native_push",
                JSONObject()
                    .put("p_installation", preferences.installation)
                    .put("p_token", token)
                    .put("p_enabled", options.notifications && notifications.permitted())
                    .put("p_muted", JSONArray(options.muted.sorted())),
            )
        }
        signature = stamp
        preferences.store
            .edit()
            .putLong("pushSyncedAt", System.currentTimeMillis())
            .putBoolean("pushTokenChanged", false)
            .apply()
    }

    suspend fun unregister(gateway: Gateway) {
        if (preferences.store.getBoolean("nativePushEnabled", false))
            withContext(Dispatchers.IO) {
                runCatching {
                    gateway.rpc(
                        "menchat_remove_native_push",
                        JSONObject().put("p_installation", preferences.installation),
                    )
                }
            }
        signature = null
        WorkManager.getInstance(context).cancelUniqueWork("menchat-push-registration")
        runCatching {
            if (FirebaseApp.getApps(context).isNotEmpty())
                FirebaseMessaging.getInstance().isAutoInitEnabled = false
        }
        notifications.clear()
    }
}

class NativeMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        if (NativeNotifications.appForeground)
            return // Foreground polling owns banners/tones and incoming call UI.
        val preferences = NativePreferences(this)
        if (
            !preferences.store.getBoolean("nativePushEnabled", false) ||
                !runCatching { SessionVault(this).contains() }.getOrDefault(false)
        )
            return
        val thread = message.data["thread"] ?: return
        val id = message.data["id"] ?: return
        if (!NativeNotifications.uuid.matches(thread) || !NativeNotifications.uuid.matches(id))
            return
        val actor = preferences.store.getString("activeActor", null) ?: return
        if (message.data["recipient"] != actor) return
        val options = preferences.read(actor)
        if (
            !options.notify(
                thread,
                message.data["kind"] != "call" && NativeNotifications.visibleThread == thread,
            )
        )
            return
        val alerts = NativeNotifications(this)
        val stamp = message.data["stamp"] ?: id
        if (alerts.already(thread, stamp)) return
        alerts.show(
            thread,
            id,
            options,
            body =
                if (message.data["kind"] == "call") "Você está recebendo uma chamada."
                else "Você tem uma nova mensagem.",
            call = if (message.data["kind"] == "call") id else null,
        )
    }

    override fun onRegistered(installationId: String) {
        val preferences = NativePreferences(this)
        val hash =
            MessageDigest.getInstance("SHA-256").digest(installationId.toByteArray()).joinToString(
                ""
            ) {
                "%02x".format(it)
            }
        val now = System.currentTimeMillis()
        if (
            preferences.store.getString("pushFidHash", null) != hash ||
                now - preferences.store.getLong("pushScheduledAt", 0) > 30_000
        ) {
            preferences.store
                .edit()
                .putString("pushFidHash", hash)
                .putLong("pushScheduledAt", now)
                .putBoolean("pushTokenChanged", true)
                .apply()
            NativePushWorker.schedule(this)
        }
    }
}

class NativePushWorker(context: Context, parameters: WorkerParameters) :
    CoroutineWorker(context, parameters) {
    companion object {
        fun schedule(context: Context) {
            WorkManager.getInstance(context)
                .enqueueUniqueWork(
                    "menchat-push-registration",
                    ExistingWorkPolicy.KEEP,
                    OneTimeWorkRequestBuilder<NativePushWorker>()
                        .setConstraints(
                            Constraints.Builder()
                                .setRequiredNetworkType(NetworkType.CONNECTED)
                                .build()
                        )
                        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                        .build(),
                )
        }
    }

    override suspend fun doWork(): Result {
        val preferences = NativePreferences(applicationContext)
        val actor = preferences.store.getString("activeActor", null) ?: return Result.success()
        if (!preferences.store.getBoolean("nativePushEnabled", false)) return Result.success()
        val vault = SessionVault(applicationContext)
        val saved = vault.read() ?: return Result.success()
        val gateway =
            Gateway().apply {
                credentials = saved
                onCredentials = { value ->
                    if (preferences.store.getString("activeActor", null) == actor)
                        vault.saveIfRefresh(saved.refresh, value)
                }
            }
        return try {
            val account = withContext(Dispatchers.IO) { gateway.account() }
            if (
                account.id != actor ||
                    preferences.store.getString("activeActor", null) != actor ||
                    !vault.contains()
            )
                return Result.success()
            val push = NativePush(applicationContext)
            push.configure(withContext(Dispatchers.IO) { gateway.publicConfiguration() })
            push.sync(gateway, actor, preferences.read(actor), true)
            Result.success()
        } catch (cancel: kotlinx.coroutines.CancellationException) {
            throw cancel
        } catch (error: Exception) {
            if (error is NativeApiException && error.status in listOf(400, 401, 403))
                Result.failure()
            else if (runAttemptCount < 8) Result.retry() else Result.failure()
        }
    }
}
