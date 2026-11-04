package app.menchat.nativeapp

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

// Tokens stay in the app sandbox, encrypted with a non-exportable Android Keystore key.
class SessionVault(context: Context) {
    private val prefs = context.getSharedPreferences("menchat-native-session", Context.MODE_PRIVATE)
    private val alias = "menchat-session-v1"

    fun contains() = prefs.contains("session")

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let {
            return it
        }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            .apply {
                init(
                    KeyGenParameterSpec.Builder(
                            alias,
                            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                        )
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .build()
                )
            }
            .generateKey()
    }

    fun save(value: Credentials) {
        val cipher =
            Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val text =
            JSONObject()
                .put("access", value.access)
                .put("refresh", value.refresh)
                .put("expires", value.expires)
                .toString()
        val encrypted = cipher.doFinal(text.toByteArray(Charsets.UTF_8))
        val blob = cipher.iv + encrypted
        check(
            prefs.edit().putString("session", Base64.encodeToString(blob, Base64.NO_WRAP)).commit()
        ) {
            "Não foi possível proteger a sessão neste dispositivo."
        }
    }

    fun read(): Credentials? =
        try {
            prefs.getString("session", null)?.let {
                val blob = Base64.decode(it, Base64.NO_WRAP)
                val cipher =
                    Cipher.getInstance("AES/GCM/NoPadding").apply {
                        init(
                            Cipher.DECRYPT_MODE,
                            key(),
                            GCMParameterSpec(128, blob.copyOfRange(0, 12)),
                        )
                    }
                val json =
                    JSONObject(
                        String(cipher.doFinal(blob.copyOfRange(12, blob.size)), Charsets.UTF_8)
                    )
                Credentials(
                    json.getString("access"),
                    json.getString("refresh"),
                    json.getLong("expires"),
                )
            }
        } catch (_: Exception) {
            runCatching { clear() }
            null
        }

    fun clear() {
        if (!prefs.edit().clear().commit()) {
            KeyStore.getInstance("AndroidKeyStore").apply {
                load(null)
                if (containsAlias(alias)) deleteEntry(alias)
            }
        }
    }
}
