package app.menchat.nativeapp

import org.json.JSONArray
import org.json.JSONObject

internal fun JSONObject.optional(key: String): String? =
    if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() }

internal fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

data class Account(val id: String, val name: String, val code: String, val status: String)

data class Conversation(
    val id: String,
    val name: String,
    val group: Boolean,
    val canSend: Boolean,
    val preview: String,
    val unread: Int,
    val lastAt: String? = null,
)

data class Message(
    val id: String,
    val seq: Long,
    val sender: String,
    val text: String,
    val created: String,
    val attachment: String?,
    val deleted: Boolean,
    val reply: String?,
)

data class Person(
    val id: String,
    val name: String,
    val typing: Boolean,
    val received: Long,
    val read: Long?,
)

data class Media(
    val id: String,
    val path: String,
    val kind: String,
    val mime: String,
    val name: String,
    val bytes: Long,
)

data class Credentials(val access: String, val refresh: String, val expires: Long)

internal fun JSONObject.message() =
    Message(
        getString("id"),
        getLong("seq"),
        getString("sender_id"),
        optString("body"),
        optString("created_at"),
        optional("attachment_id"),
        optional("deleted_at") != null,
        optional("reply_to"),
    )

internal fun nativeTime(value: String): String =
    try {
        java.time.OffsetDateTime.parse(value)
            .atZoneSameInstant(java.time.ZoneId.systemDefault())
            .format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"))
    } catch (_: Exception) {
        ""
    }
