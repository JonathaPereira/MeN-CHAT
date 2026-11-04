package app.menchat.nativeapp

import android.media.MediaRecorder
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowMediaRecorder
import org.robolectric.util.ReflectionHelpers

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35, 36])
class RecorderLifecycleTest {
    @Test
    fun backgroundReleasesMicrophoneAndDiscardsUnsentRecording() {
        val model = MainModel(RuntimeEnvironment.getApplication())
        model.select(Conversation("fixture-thread", "Teste", true, true, "", 0))
        model.startRecording()
        assertTrue(model.state.value.recording)
        val recorder: MediaRecorder = ReflectionHelpers.getField(model, "recorder")
        assertEquals(ShadowMediaRecorder.STATE_RECORDING, shadowOf(recorder).state)
        model.onBackground()
        assertFalse(model.state.value.recording)
        assertEquals(ShadowMediaRecorder.STATE_RELEASED, shadowOf(recorder).state)
        assertNull(model.state.value.voice)
    }
}
