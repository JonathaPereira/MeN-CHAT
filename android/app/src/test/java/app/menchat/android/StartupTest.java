package app.menchat.android;

import static org.junit.Assert.*;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.content.ComponentName;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import android.content.pm.ActivityInfo;
import org.robolectric.annotation.Config;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {35, 36})
public class StartupTest {
    @Test public void startsFromInstalledManifestWithoutCrashing() throws Exception {
        ActivityController<LauncherActivity> controller = Robolectric.buildActivity(LauncherActivity.class);
        try {
            Activity activity = controller.create().get();
            assertNotNull(activity);
            ActivityInfo info = activity.getPackageManager().getActivityInfo(
                new ComponentName(activity, LauncherActivity.class), PackageManager.GET_META_DATA);
            assertEquals("https://men-chat.vercel.app/conta/chat",
                info.metaData.getString("android.support.customtabs.trusted.DEFAULT_URL"));
        } finally { controller.destroy(); }
    }
    @Test public void siteSettingsComponentIsRegisteredBeforeBrowserLaunch() throws Exception {
        android.content.Context context = org.robolectric.RuntimeEnvironment.getApplication();
        ComponentName component = new ComponentName(context,
            com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity.class);
        ActivityInfo info = context.getPackageManager().getActivityInfo(component, PackageManager.GET_META_DATA);
        assertEquals("https://men-chat.vercel.app",
            info.metaData.getString("android.support.customtabs.trusted.MANAGE_SPACE_URL"));
        assertEquals(component.getClassName(), context.getApplicationInfo().manageSpaceActivityName);
        context.getPackageManager().setComponentEnabledSetting(component,
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity.addSiteSettingsShortcut(context, null);
    }

}
