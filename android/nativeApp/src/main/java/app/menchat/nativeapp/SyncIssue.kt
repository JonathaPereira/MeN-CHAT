package app.menchat.nativeapp

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException
import org.json.JSONException

// Never retain response bodies, request URLs, identifiers or credentials in diagnostics.
internal class NativeApiException(val status: Int, val apiCode: String?, message: String) :
    IllegalStateException(message)

internal fun safeApiCode(value: String?): String? =
    value?.takeIf {
        it in
            setOf(
                "42501",
                "23514",
                "23503",
                "23505",
                "P0001",
                "PGRST202",
                "PGRST204",
                "PGRST301",
                "PGRST116",
            )
    }

internal enum class SyncStage(val label: String) {
    LISTA("lista de conversas"),
    HISTORICO("histórico de mensagens"),
    PARTICIPANTES("participantes e digitação"),
    LEITURA("confirmação de leitura"),
}

internal fun syncIssue(stage: SyncStage, error: Exception): String {
    val (message, detail) =
        when (error) {
            is NativeApiException -> {
                val message =
                    when (error.status) {
                        401 -> "Sua sessão expirou. Entre novamente."
                        403 -> "Sem permissão para atualizar ${stage.label}."
                        404 -> "Recurso indisponível no servidor ao atualizar ${stage.label}."
                        429 ->
                            "Limite de consultas atingido. Aguarde para atualizar ${stage.label}."
                        else -> "O servidor retornou um erro ao atualizar ${stage.label}."
                    }
                message to
                    "HTTP ${error.status}${safeApiCode(error.apiCode)?.let { " · $it" } ?: ""}"
            }
            is JSONException ->
                "Resposta em formato incompatível ao atualizar ${stage.label}." to "FORMATO"
            is SocketTimeoutException ->
                "Tempo de espera esgotado ao atualizar ${stage.label}." to "TEMPO"
            is UnknownHostException ->
                "Não foi possível localizar o servidor de ${stage.label}." to "DNS"
            is SSLException ->
                "Não foi possível validar a conexão segura de ${stage.label}." to "TLS"
            is IOException ->
                "Falha de rede ao atualizar ${stage.label}. A tentativa será repetida." to "REDE"
            else -> "Não foi possível atualizar ${stage.label}." to "INTERNO"
        }
    return "$message (${stage.name} · $detail)"
}
