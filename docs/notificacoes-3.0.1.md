# Notificações Android 3.0.1

Atualiza sobre 3.0.0, mesma assinatura, sem desinstalar. O usuário confirmou chamadas web/Android e recebimento com o APK fechado na 3.0; novas mudanças precisam de conferência no Poco.

- Mensagens: nome do remetente e resumo de até 160 caracteres, com reticências. Mídia sem legenda aparece como Foto, Vídeo, Áudio, Figurinha ou Anexo; não enviamos URLs nem arquivos no push.
- Chamadas: canal próprio com alta importância e pulsos de vibração longos/repetidos. Aviso com app fechado expira em até 45 segundos; tocar abre o app e cancela o aviso. Com app aberto, vibração cessa ao atender/recusar/encerrar ou ao atualizar o estado de uma chamada encerrada. Volume, vibração, Não Perturbe e escolhas do canal Android continuam soberanos. Intensidade física depende do aparelho.

## Ativar

1. Supabase → SQL Editor → New query: aplique somente `supabase/migrations/20261105001100_notification_previews.sql`, após 1–10. Não execute arquivos de tests. Sem essa migração, entrega usa o aviso genérico anterior.
2. Aguarde o deployment atualizado na Vercel ficar Ready. As chaves Firebase existentes continuam as mesmas.
3. Baixe `public/downloads/menchat-3.0.1.apk`, instale por cima e abra novamente.
4. Engrenagem → Notificações → **Nome e prévia nas notificações**: ative para ver o conteúdo. Escolhas salvas anteriormente são preservadas, então confira o botão mesmo depois de atualizar. Desative para voltar ao aviso genérico.
5. Confira Receber avisos, Vibrar e permissões do Android. O canal novo **Chamadas MenChat** fica separado dos canais de mensagens, sem sobrescrever o silêncio escolhido pelo usuário.
6. Envie uma mensagem curta/longa e áudio/foto de outra conta, depois telefone com receptor em segundo plano. Teste também prévia desligada, silêncio, vibração desligada, Não Perturbe e tela bloqueada.

A alteração de privacidade foi solicitada pelo proprietário: remetente/resumo agora podem percorrer o Firebase Cloud Messaging. Ocultar a prévia no aparelho controla sua exibição, não remove esses campos do transporte. Tela bloqueada usa notificação PRIVATE e segue as permissões do Android. Apagar uma mensagem não recolhe uma prévia já entregue. A função SQL só é executável por service_role e nega prévias para destinatário externo ou fonte apagada/ocultada. Nada é registrado em logs ou disponibilizado por API pública.

Arquivos principais: NativeNotifications/NativeCalls/NativePush/NativeOptions/NativeSettings.kt, lib/native-push/config.ts e server.ts, migração 11, scripts e testes de release. Primeiro aplicar SQL, depois atualizar app; não precisa gerar chaves Firebase novas.

Verificações locais aprovadas: lint, tipos, build web, 63 testes Node, 71 Android/Robolectric, 39 web oficiais e três testes de instalação. PostgreSQL descartável validou a migração 11, destinatário autorizado, bloqueio de terceiros, exclusão e privilégio exclusivo do servidor, além das regras anteriores. Release com assinatura original, versionCode 9, não depurável, manifesto e ELF/ZIP 16 KB de 64 bits conferidos. A intensidade/entrega das novas notificações ainda requer teste no Poco; testes locais não comprovam FCM hospedado.
