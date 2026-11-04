package app.menchat.nativeapp

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException
import org.json.JSONException
import org.junit.Assert.*
import org.junit.Test

class SyncIssueTest {
    @Test
    fun localFailuresIdentifyCategoryWithoutExposingExceptionDetails() {
        val privateDetail = "private-body actor-token https://private.example.test/member-id"
        val errors =
            listOf(
                IOException(privateDetail) to "REDE",
                SocketTimeoutException(privateDetail) to "TEMPO",
                UnknownHostException(privateDetail) to "DNS",
                SSLException(privateDetail) to "TLS",
                JSONException(privateDetail) to "FORMATO",
                IllegalStateException(privateDetail) to "INTERNO",
            )
        errors.forEach { (error, category) ->
            val notice = syncIssue(SyncStage.HISTORICO, error)
            assertTrue(notice.contains("HISTORICO · $category"))
            assertFalse(notice.contains("private-body"))
            assertFalse(notice.contains("actor-token"))
            assertFalse(notice.contains("member-id"))
        }
    }

    @Test
    fun httpDiagnosticsOnlyKeepRecognizedCodesAndNeverServerMessages() {
        val notice =
            syncIssue(
                SyncStage.PARTICIPANTES,
                NativeApiException(404, "PGRST202", "private-message"),
            )
        assertTrue(notice.contains("PARTICIPANTES · HTTP 404 · PGRST202"))
        assertFalse(notice.contains("private-message"))
        assertNull(safeApiCode("actor-token"))
        assertNull(safeApiCode("PERSON"))
        assertNull(safeApiCode("https://private.example.test"))
        val hidden =
            syncIssue(SyncStage.LISTA, NativeApiException(500, "actor-token", "private-message"))
        assertFalse(hidden.contains("actor-token"))
        assertFalse(hidden.contains("private-message"))
        assertTrue(
            syncIssue(SyncStage.HISTORICO, NativeApiException(401, null, ""))
                .contains("sessão expirou")
        )
    }
}
