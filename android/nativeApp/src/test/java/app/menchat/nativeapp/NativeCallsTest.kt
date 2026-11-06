package app.menchat.nativeapp

import android.Manifest
import android.content.Context
import android.os.Looper
import java.io.IOException
import java.time.Duration
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.webrtc.VideoTrack

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class NativeCallsTest {
    private val actor = "10000000-0000-4000-8000-000000000001"
    private val thread = "20000000-0000-4000-8000-000000000001"
    private lateinit var calls: NativeCalls
    private lateinit var transport: FakeTransport
    private lateinit var life: FakeLife
    private var media: FakeMedia? = null

    @Before
    fun setup() {
        val context = RuntimeEnvironment.getApplication()
        shadowOf(context)
            .grantPermissions(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA)
        transport = FakeTransport()
        life = FakeLife()
        calls =
            NativeCalls(
                context,
                Gateway(),
                NativePreferences(context),
                transport,
                CallMediaFactory { _, _, video, _, events ->
                    FakeMedia(video, events).also { media = it }
                },
                life,
            )
        calls.bind(actor, true)
        calls.foreground(true)
    }

    @After
    fun close() {
        transport.release?.countDown()
        calls.close()
    }

    private fun await(condition: () -> Boolean) {
        val deadline = System.nanoTime() + 8_000_000_000
        while (System.nanoTime() < deadline) {
            shadowOf(Looper.getMainLooper()).idle()
            if (condition()) return
            Thread.sleep(5)
        }
        fail("Operação não concluiu")
    }

    @Test
    fun leavingAppDuringConfigurationNeverStartsCameraOrService() {
        transport.configEntered = CountDownLatch(1)
        transport.release = CountDownLatch(1)
        calls.start(thread, true)
        await { transport.configEntered!!.count == 0L }
        calls.foreground(false)
        transport.release!!.countDown()
        await { !calls.state.value.busy }
        assertNull(media)
        assertFalse(life.active)
        assertNull(transport.id)
    }

    @Test
    fun deniedCameraNeverAcquiresDevicesOrStartsForegroundService() {
        shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(Manifest.permission.CAMERA)
        calls.start(thread, true)
        shadowOf(Looper.getMainLooper()).idle()
        assertNotNull(calls.state.value.error)
        assertNull(media)
        assertFalse(life.active)
        assertNull(transport.id)
    }

    @Test
    fun endDuringUnconfirmedStartReleasesMediaAndCancelsRemoteCallAfterResponse() {
        transport.entered = CountDownLatch(1)
        transport.release = CountDownLatch(1)
        calls.start(thread, true)
        await { transport.entered!!.count == 0L }
        assertTrue(life.active)
        assertNotNull(media)
        assertFalse(media!!.closed)
        calls.end()
        assertTrue(media!!.closed)
        assertFalse(life.active)
        transport.release!!.countDown()
        await { transport.left.isNotEmpty() }
        assertNull(calls.state.value.active)
        assertFalse(calls.state.value.busy)
    }

    @Test
    fun muteCameraAndRouteHaveEffectsAndLogoutClosesAllDevices() {
        calls.start(thread, true)
        await { calls.state.value.active != null }
        calls.microphone()
        calls.camera()
        calls.speaker()
        shadowOf(Looper.getMainLooper()).idle()
        assertFalse(media!!.micOn)
        assertFalse(media!!.cameraOn)
        assertFalse(media!!.speakerOn)
        runBlocking { calls.logout() }
        assertTrue(media!!.closed)
        assertFalse(life.active)
        assertNull(calls.state.value.active)
        assertFalse(calls.state.value.ready)
    }

    @Test
    fun transientNetworkFailureKeepsCallButRevocationReleasesDevices() {
        calls.foreground(true)
        calls.start(thread, false)
        await { calls.state.value.active != null }
        transport.failure = IOException("fixture offline")
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(3))
        await { calls.state.value.error != null }
        assertNotNull(calls.state.value.active)
        assertFalse(media!!.closed)
        transport.failure = NativeApiException(403, "42501", "fixture denied")
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(2))
        await { calls.state.value.active == null }
        assertTrue(media!!.closed)
        assertFalse(life.active)
    }

    private inner class FakeTransport : CallTransport {
        var id: String? = null
        var entered: CountDownLatch? = null
        var configEntered: CountDownLatch? = null
        var release: CountDownLatch? = null
        var failure: Exception? = null
        var members: List<CallMember> = emptyList()
        var queuedSignals: List<CallSignal> = emptyList()
        val left = CopyOnWriteArrayList<String>()

        override fun configuration(): CallIce {
            configEntered?.let {
                it.countDown()
                release?.await(5, TimeUnit.SECONDS)
            }
            return CallIce(emptyList(), System.currentTimeMillis() / 1000 + 1200)
        }

        override fun inbox() = emptyList<CallHeader>()

        override fun start(id: String, thread: String, video: Boolean) {
            this.id = id
            entered?.countDown()
            release?.await(5, TimeUnit.SECONDS)
        }

        override fun join(id: String) {
            this.id = id
        }

        override fun leave(id: String) {
            left += id
        }

        override fun state(id: String, mic: Boolean, video: Boolean): CallSnapshot {
            failure?.let { throw it }
            return CallSnapshot(
                CallHeader(id, thread, actor, video, "active", null, "2026-11-05T00:00:00Z"),
                members,
            )
        }

        override fun signals(id: String, after: Long) = queuedSignals.filter { it.seq > after }

        override fun signal(
            call: String,
            to: String,
            toDevice: String,
            id: String,
            kind: String,
            payload: JSONObject,
        ) {}

        override fun dispatch(id: String) {}
    }

    private class FakeLife : CallLifeSupport {
        var active = false

        override fun start(video: Boolean, end: () -> Unit) {
            active = true
        }

        override fun stop() {
            active = false
        }
    }

    private class FakeMedia(video: Boolean, private val events: CallMediaEvents) : CallMedia {
        var closed = false
        override var micOn = true
        override var cameraOn = video
        override var speakerOn = video
        override val localVideo: VideoTrack? = null
        val receivedSeqs = CopyOnWriteArrayList<Long>()

        override fun connected() = emptySet<String>()

        override fun remoteVideo(id: String): VideoTrack? = null

        override fun reconcile(members: List<CallMember>) {}

        override suspend fun receive(signal: CallSignal) {
            if (signal.kind == "broken") throw IllegalStateException("corrupted signal")
            receivedSeqs += signal.seq
        }

        override fun renew(ice: CallIce) {}

        override fun microphone(value: Boolean) {
            micOn = value
            events.changed()
        }

        override fun camera(value: Boolean) {
            cameraOn = value
            events.changed()
        }

        override fun route(speaker: Boolean) {
            speakerOn = speaker
            events.changed()
        }

        override fun switchCamera() {}

        override fun renderer(
            context: Context,
            track: VideoTrack,
            mirror: Boolean,
        ): NativeRtcRenderer = error("Not used")

        override fun releaseRenderer(value: NativeRtcRenderer) {}

        override fun close() {
            closed = true
        }
    }

    @Test
    fun audioConstraintsEnforceEchoCancellationAutoGainAndHighpassFilter() {
        val withNoise = audioConstraints(true)
        val mandatory = withNoise.mandatory.associate { it.key to it.value }
        val optional = withNoise.optional.associate { it.key to it.value }
        assertEquals("true", mandatory["googEchoCancellation"])
        assertEquals("true", mandatory["googAutoGainControl"])
        assertEquals("true", mandatory["googHighpassFilter"])
        assertEquals("true", mandatory["googNoiseSuppression"])
        assertEquals("false", optional["googAudioMirroring"])

        val withoutNoise = audioConstraints(false)
        val mandatoryNoNs = withoutNoise.mandatory.associate { it.key to it.value }
        assertEquals("true", mandatoryNoNs["googEchoCancellation"])
        assertEquals("false", mandatoryNoNs["googNoiseSuppression"])
    }

    @Test
    fun maximizeTogglesLocalAndRemoteVideoAndResetsWhenCameraTurnsOff() {
        val peerId = "10000000-0000-4000-8000-000000000002"
        transport.members =
            listOf(
                CallMember(actor, "Você", null, "joined", "dev-1", true, true),
                CallMember(peerId, "Ana", null, "joined", "dev-2", true, true),
            )
        calls.start(thread, true)
        await { calls.state.value.active != null }
        assertNull(calls.state.value.maximized)

        calls.maximize("self")
        assertEquals("self", calls.state.value.maximized)

        calls.maximize(peerId)
        assertEquals(peerId, calls.state.value.maximized)

        calls.maximize(peerId)
        assertNull(calls.state.value.maximized)

        calls.maximize("self")
        assertEquals("self", calls.state.value.maximized)
        calls.camera()
        shadowOf(Looper.getMainLooper()).idle()
        assertFalse(calls.state.value.video)
        assertNull(calls.state.value.maximized)
    }

    @Test
    fun malformedSignalDoesNotBlockSubsequentSignalsAndRecoveryClearsTransientError() {
        val peerId = "10000000-0000-4000-8000-000000000002"
        transport.queuedSignals =
            listOf(
                CallSignal(1, peerId, "dev-2", "broken", JSONObject()),
                CallSignal(2, peerId, "dev-2", "offer", JSONObject()),
            )
        calls.start(thread, false)
        await { calls.state.value.active != null }
        transport.failure = IOException("transient glitch")
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(3))
        await { calls.state.value.error != null }
        assertTrue(calls.state.value.error!!.contains("instável"))

        transport.failure = null
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(2))
        await { calls.state.value.error == null && media!!.receivedSeqs.contains(2L) }
        assertEquals(listOf(2L), media!!.receivedSeqs)
    }
}
