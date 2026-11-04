# Android, APK e notificações

O APK MenChat 1.0.1 usa Trusted Web Activity e Android Browser Helper oficial, sobre a publicação HTTPS. Requer Android 8 ou posterior e Chrome atualizado; utiliza as mesmas contas, conversas e recursos da web. Não precisa copiar dados entre duas versões. A atualização das telas vem do site; mudanças no pacote Android exigem instalar um APK com versão maior e a mesma assinatura.

## Instalação

No site, use **Baixar app Android → Baixar APK Android**. Abra o arquivo no Android e, se solicitado, permita instalação para o navegador usado. O pacote é assinado, sem modo de depuração, mas não foi publicado na Play Store. O Android pode apresentar os avisos habituais de instalação externa. O mesmo painel permite instalar como PWA no Chrome, sem baixar APK.

O vínculo entre `app.menchat.android` e o domínio é publicado em `/.well-known/assetlinks.json`. Depois do deploy, o Chrome deve validar esse vínculo e abrir a janela sem barra de endereço. Se ainda não validou, abre uma aba personalizada com o endereço visível. Não desative a validação para esconder a barra. Cadastro e conversas continuam exigindo convite/Auth/RLS.

Texto, grupos, respostas, fotos, vídeos, gravação de áudio, câmera, anexos e perfis usam os recursos já existentes. Câmera/microfone/arquivos pedem permissão do navegador/Android. Chamadas de voz/vídeo, offline de conversas, criptografia ponta a ponta, integração com contatos e Play Store não fazem parte desta entrega.

## Ativar notificações com o app fechado

Esta configuração única depende do proprietário; não há credenciais administrativas deste projeto na nuvem de desenvolvimento. O APK sozinho não configura o servidor.

1. No Supabase do MenChat → SQL Editor → New query, aplique uma vez `supabase/migrations/20261104000800_android_push.sql`, após as versões 1–7.
2. Na pasta do projeto, execute `npm ci` e `npm run push:keys`. O comando gera chaves VAPID e um segredo de agendamento. **Não compartilhe a saída e não a coloque no GitHub.**
3. Vercel → MenChat → Settings → Environment Variables: adicione `MENCHAT_VAPID_PUBLIC_KEY`, `MENCHAT_VAPID_PRIVATE_KEY`, `MENCHAT_PUSH_CRON_SECRET` e `MENCHAT_VAPID_SUBJECT`, conforme a saída, no ambiente Production. Preserve `SUPABASE_SECRET_KEY` já usada pelos convites. Faça Redeploy para aplicar.
4. Supabase → Integrations → Vault: crie o segredo com nome `menchat_push_cron_secret` e valor igual ao `MENCHAT_PUSH_CRON_SECRET` da Vercel. O valor é privado; não cole em mensagens ou arquivos versionados.
5. No SQL Editor, execute `supabase/setup-push-scheduler.sql`. Agenda a retomada de entregas a cada minuto. Exige as extensões `pg_cron`, `pg_net` e Vault disponíveis no projeto. Não execute este script no banco descartável dos testes.
6. No celular, entre no MenChat → engrenagem → Notificações → **Ativar notificações em segundo plano**. Aceite a permissão. Faça isso em cada aparelho desejado, até cinco por conta. Confira também as permissões de notificação do MenChat/Chrome no Android.
7. Teste com duas contas autorizadas: feche o app receptor, envie texto e mídia da outra conta e toque no aviso recebido. Confira também silenciamento, desativação e saída da conta. Economia de bateria, conexão e configurações do Android podem atrasar ou impedir avisos.

A tentativa imediata acontece depois de enviar; a fila no banco permite retomada pelo agendamento caso haja falha ou a aba seja fechada. Entregas têm reserva de um minuto, até três tentativas e expiração de 24 horas na fila. A validade do aviso no serviço de push é uma hora. Mesmo aviso usa a mesma identificação para reduzir duplicatas após falha de rede. Não prometa entrega instantânea ou garantida pelo Android.

## Privacidade e controles

A notificação mostra apenas **“Você tem uma nova mensagem.”**. Nunca transporta texto da mensagem, nome do remetente, URLs de anexos ou tokens de sessão. Endpoints e chaves de dispositivos ficam em tabelas privadas, sem leitura para membros; somente o servidor de entrega tem acesso. O remetente autenticado só aciona sua própria fila; o agendamento exige segredo separado. Destinatários são participantes ativos, exceto o autor; o banco revalida participação, silenciamento e desativação antes de cada tentativa.

Preferências de aviso/silenciamento deste aparelho são sincronizadas ao abrir o app e ao mudá-las. Sair pela opção da conta desassocia o dispositivo antes de encerrar a sessão; apagar cookies diretamente não executa essa ação. A inscrição pode ser desativada nas configurações do app ou do Android. A chave VAPID privada e a secret do Supabase ficam somente no servidor. Não troque chaves VAPID sem planejar reinscrição dos dispositivos.

O service worker mantém navegação pela rede, sem armazenar conversas, mídia ou tokens em Cache Storage. Avisos com o app aberto e push têm controles separados; não há fallback para acesso público em caso de erro de Auth.

## Compilar e manter a assinatura

Projeto Gradle em `android/`, JDK 21 (com compilador `javac`), Android SDK 36 e Build Tools 36.0.0. Configure `ANDROID_HOME`. Use as variáveis privadas `MENCHAT_KEYSTORE` (caminho absoluto), `MENCHAT_STORE_PASSWORD`, `MENCHAT_KEY_PASSWORD` e `MENCHAT_KEY_ALIAS` (`menchat`), e execute `./gradlew assembleRelease` dentro de `android/` (Windows: `gradlew.bat assembleRelease`). Nunca grave valores em `build.gradle`, GitHub ou no APK.

O APK assinado sai em `android/app/build/outputs/apk/release/app-release.apk`; após verificar assinatura e permissões, publique em `public/downloads/menchat-1.0.1.apk` e atualize versão/checksum. A assinatura deve corresponder à impressão SHA-256 em `public/.well-known/assetlinks.json`.

O backup privado da assinatura é entregue separadamente ao proprietário. Guarde o arquivo fora do repositório, com cópia segura. Perder a chave impede atualizar os APKs instalados; divulgar a chave permite falsificar atualizações. O repositório contém somente a impressão pública do certificado e o APK.

## Verificação

Lint, tipos, build web, testes de regras e de navegador; PostgreSQL descartável com isolamento da fila, bloqueio de terceiros, controle de lease, silenciamento e remoção. APK compilado e assinatura/permissões conferidas com Android Build Tools. Os testes de câmera usam dispositivo sintético, e os de push não comprovam entrega real pelo serviço externo. A conferência final no Android físico e no Supabase/Vercel depende da configuração acima.

## Correção de abertura — 1.0.1

A versão 1.0.0 omitia a declaração de `ManageDataLauncherActivity`, usada pela biblioteca ao configurar o atalho de dados do site. O Android encerrava o app com `IllegalArgumentException: Component class ... does not exist`. A 1.0.1 registra esse componente e seus metadados, mantendo a mesma assinatura e aumentando o versionCode para 2. Instale por cima da anterior, sem desinstalar. Não exige SQL nem chaves novas.

O link antigo do site redireciona para o APK corrigido. O artefato 1.0.0 foi retirado da pasta pública da versão atual. `./gradlew testDebugUnitTest` executa testes de abertura e do componente no Android 15/16 simulado por Robolectric; isso complementa a compilação, sem substituir a conferência no Poco físico.
