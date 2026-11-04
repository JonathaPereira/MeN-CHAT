package app.menchat.nativeapp

import android.content.pm.PackageManager
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35, 36])
class NativeStartupTest {
    @Test
    fun launcherUsesNativeActivityAndNoBrowserHelper() {
        val context = RuntimeEnvironment.getApplication()
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)!!
        assertEquals(
            NativeActivity::class.java.name,
            context.packageManager.getActivityInfo(launch.component!!, 0).targetActivity,
        )
        val info =
            context.packageManager.getPackageInfo(
                context.packageName,
                PackageManager.GET_ACTIVITIES,
            )
        assertFalse(
            info.activities!!.any {
                it.targetActivity == null && it.name.startsWith("com.google.androidbrowserhelper")
            }
        )
        assertFalse(info.activities!!.any { it.name.contains("WebView") })
        assertThrows(ClassNotFoundException::class.java) {
            Class.forName("com.google.androidbrowserhelper.trusted.TwaLauncher")
        }
        val controller = Robolectric.buildActivity(NativeActivity::class.java)
        try {
            assertNotNull(controller.setup().get())
        } finally {
            controller.destroy()
        }
    }
}
