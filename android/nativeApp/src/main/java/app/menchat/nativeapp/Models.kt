package app.menchat.nativeapp

import org.json.JSONArray
import org.json.JSONObject

internal fun JSONObject.optional(key: String): String? =
    if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() }

internal fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

data class Account(
    val id: String,
    val name: String,
    val code: String,
    val status: String,
    val avatarPath: String? = null,
    val showCode: Boolean = true,
    val lookup: Boolean = true,
    val readReceipts: Boolean = true,
    val showTyping: Boolean = true,
    val admin: Boolean = false,
)

internal data class ProfileDraft(
    val name: String,
    val status: String,
    val showCode: Boolean,
    val lookup: Boolean,
    val readReceipts: Boolean,
    val showTyping: Boolean,
    val photo: LocalAttachment? = null,
    val removePhoto: Boolean = false,
)

data class Conversation(
    val id: String,
    val name: String,
    val group: Boolean,
    val canSend: Boolean,
    val preview: String,
    val unread: Int,
    val lastAt: String? = null,
    val avatarPath: String? = null,
    val creator: String? = null,
    val owner: String? = null,
    val lastSender: String? = null,
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
    val mentions: Set<String> = emptySet(),
)

data class Person(
    val id: String,
    val name: String,
    val typing: Boolean,
    val received: Long,
    val read: Long?,
    val role: String = "member",
    val status: String = "",
    val avatarPath: String? = null,
    val code: String? = null,
)

data class Media(
    val id: String,
    val path: String,
    val kind: String,
    val mime: String,
    val name: String,
    val bytes: Long,
    val sticker: Boolean = false,
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
        optJSONArray("mention_ids")?.let { array ->
            (0 until array.length()).map { array.getString(it) }.toSet()
        } ?: emptySet(),
    )

internal fun nativeTime(value: String): String =
    try {
        java.time.OffsetDateTime.parse(value)
            .atZoneSameInstant(java.time.ZoneId.systemDefault())
            .format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"))
    } catch (_: Exception) {
        ""
    }

internal data class NativeInvitation(
    val id: String,
    val email: String,
    val expires: String,
    val state: String,
)
