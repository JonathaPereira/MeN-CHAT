package app.menchat.nativeapp

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class NativeOptionsGroupsTest {
    @Test
    fun incomingCallsUseDedicatedHighPriorityChannelAndLongVibration() {
        val context = RuntimeEnvironment.getApplication()
        val alerts = NativeNotifications(context)
        val manager = context.getSystemService(android.app.NotificationManager::class.java)
        org.robolectric.Shadows.shadowOf(context)
            .grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
        assertFalse(
            manager.getNotificationChannel(alerts.callChannel(false, false)).shouldVibrate()
        )
        org.robolectric.Shadows.shadowOf(manager).setNotificationsEnabled(true)
        val id = alerts.callChannel(false, true)
        val channel = manager.getNotificationChannel(id)
        assertEquals(android.app.NotificationManager.IMPORTANCE_HIGH, channel.importance)
        assertTrue(channel.shouldVibrate())
        assertTrue(channel.vibrationPattern.sum() > 3000)
        assertNull(channel.sound)
        alerts.show("thread", "incoming-test", NativeOptions(sound = false), call = "call-id")
        val notification = manager.activeNotifications.first().notification
        assertTrue(notification.flags and android.app.Notification.FLAG_INSISTENT != 0)
        assertEquals(45000L, notification.timeoutAfter)
        alerts.clear()
    }

    @Test
    fun preferencesPersistEffectsAndKeepMuteListsSeparateByAccount() {
        val context = RuntimeEnvironment.getApplication()
        val prefs = NativePreferences(context)
        prefs.write(
            NativeOptions(
                theme = "system",
                textScale = 1.15f,
                sound = false,
                dataSaver = true,
                enterSends = true,
                playbackRate = 1.5f,
                muted = setOf("private-a"),
            ),
            "account-a",
        )
        val first = prefs.read("account-a")
        assertEquals("system", first.theme)
        assertEquals(1.5f, first.playbackRate)
        assertFalse(first.sound)
        assertTrue(first.enterSends)
        assertFalse(first.auto("image"))
        assertFalse(first.auto("audio"))
        assertFalse(first.notify("private-a", false))
        assertFalse(first.notify("other", true))
        assertTrue(first.notify("other", false))
        assertTrue(prefs.read("account-b").muted.isEmpty())
        prefs.store
            .edit()
            .putFloat("textScale", 100f)
            .putFloat("playbackRate", 25f)
            .putString("theme", "unknown")
            .commit()
        assertEquals(1f, prefs.read().textScale)
        assertEquals(1f, prefs.read().playbackRate)
        assertEquals("dark", prefs.read().theme)
    }

    @Test
    fun creatorAndOwnerRemainProtectedEvenAfterTransfer() {
        val creator = Person("creator", "Criador", false, 0, 0, "admin")
        val owner = Person("owner", "Dono", false, 0, 0, "admin")
        val admin = Person("admin", "Admin", false, 0, 0, "admin")
        val member = Person("member", "Membro", false, 0, 0, "member")
        val group =
            Conversation("group", "Grupo", true, true, "", 0, creator = "creator", owner = "owner")
        val people = listOf(creator, owner, admin, member)
        assertEquals(setOf("transfer"), groupActions(group, people, "owner", creator))
        assertTrue(groupActions(group, people, "admin", creator).isEmpty())
        assertTrue(groupActions(group, people, "admin", owner).isEmpty())
        assertEquals(setOf("promote", "remove"), groupActions(group, people, "admin", member))
        assertTrue(groupActions(group, people, "admin", admin).isEmpty())
        assertEquals(
            setOf("transfer", "demote", "remove"),
            groupActions(group, people, "owner", admin),
        )
        assertTrue(groupActions(group, people, "member", admin).isEmpty())
    }

    @Test
    fun stickerPreviewAndSavedCropUseTheSameTransformWithTransparency() {
        val bitmap = Bitmap.createBitmap(80, 40, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(Color.TRANSPARENT)
        Canvas(bitmap).drawColor(Color.RED)
        val preview = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888)
        val crop = StickerCrop(1.5f, .5f, -.25f, 1, true)
        StickerDrawing.draw(Canvas(preview), bitmap, 512f, crop)
        assertEquals(Color.RED, preview.getPixel(256, 256))
        val context = RuntimeEnvironment.getApplication()
        val actor = "10000000-0000-4000-8000-000000000001"
        val shelf = NativeStickerShelf(context)
        val item = shelf.save(actor, bitmap, StickerCrop())
        try {
            val saved = android.graphics.BitmapFactory.decodeFile(item.file.path)
            assertEquals(512, saved.width)
            assertEquals(512, saved.height)
            assertEquals(0, Color.alpha(saved.getPixel(2, 2)))
            assertTrue(item.file.length() <= 100000)
            saved.recycle()
            assertEquals(listOf(item.id), shelf.list(actor).map { it.id })
            shelf.remove(actor, item)
            assertTrue(shelf.list(actor).isEmpty())
        } finally {
            item.file.delete()
            bitmap.recycle()
            preview.recycle()
        }
    }

    @Test
    fun foregroundAndPushDeduplicationUseCanonicalTimeAndAccountScope() {
        val context = RuntimeEnvironment.getApplication()
        val prefs = NativePreferences(context)
        val alerts = NativeNotifications(context)
        prefs.store.edit().putString("activeActor", "first").commit()
        assertFalse(alerts.already("thread", "2026-11-05T00:00:00Z"))
        assertTrue(alerts.already("thread", "1793836800000"))
        assertTrue(alerts.already("thread", "2026-11-04T23:59:59Z"))
        prefs.store.edit().putString("activeActor", "second").commit()
        assertFalse(alerts.already("thread", "1793836800000"))
    }
}
