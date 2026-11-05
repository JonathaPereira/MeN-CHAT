# MenChat Android 3.0 e chamadas

Atualização do APK Kotlin/Compose, mantendo `app.menchat.android`, a assinatura e os dados da 2.2.0. Instale por cima, sem desinstalar. O usuário confirmou o funcionamento da **2.2.0** no aparelho; isso não valida automaticamente esta versão. A web continua funcionando com as mesmas contas e conversas.

## O que muda

- Engrenagem → **Aparência**: sistema/claro/escuro e tamanho de texto.
- **Notificações**: som original MenChat, prévia interna, vibração, silenciamento por conversa, teste e acesso aos canais do Android. O botão “Ouvir som MenChat” permite experimentar o toque antes de ativar push.
- **Conversas e áudio**: Enter para enviar, redução de ruído e velocidade de reprodução. **Dados e armazenamento**: economia de dados e carregamento de prévias; mídia não toca sozinha nem é salva automaticamente na galeria. **Privacidade** abre as opções sincronizadas do perfil.
- Criação/gestão de grupos: nome, convite pelo código, administradores, remoção, transferência de propriedade e saída. Criador protegido; proprietário transfere antes de sair com outras pessoas no grupo.
- Administrador do aplicativo gera/revoga/compartilha convites dentro do Android. Cada link continua vinculado ao e-mail e exige o OTP do destinatário; encaminhar o link não transfere o acesso. Primeiro acesso, recuperação de senha e aceite do convite usam a página web segura; após concluir, a pessoa entra no APK.
- Favoritos privados, respostas para texto/mídia, menções, seletor de emojis e coleção de figurinhas por conta/aparelho. Criar/importar imagem, enquadrar/recortar, girar e enviar WebP estático de 512 × 512, até 100 KB, coleção de até 40 itens. Não importa pacotes do WhatsApp nem figurinhas animadas.
- Câmera, fotos/vídeos, documentos, perfil/foto, gravação com dois toques, digitação/leitura, não lidas e apagar para mim/todos preservados. O microfone fica à direita.
- Chamadas de voz/vídeo na web e no Android: atender/recusar, microfone, câmera, alternar câmera, encerrar e minimizar. No Android, saída de áudio e serviço de chamada em andamento; captura começa somente após a ação e permissão da pessoa. Chamada em grupo limitada a **quatro participantes simultâneos**, em malha P2P com TURN quando necessário. Não é SFU, telefonia do sistema, compartilhamento de tela ou gravação.

Push e chamadas estão implementados, mas **não são ativados pela simples instalação do APK**: exigem a configuração abaixo. Não há credenciais de produção no ambiente de desenvolvimento, nem comprovação de entrega FCM ou chamada Android física nesta entrega.

## 1. Preparar o Supabase (primeiro passo)

No [Supabase Dashboard](https://supabase.com/dashboard), escolha o projeto **do MenChat** e abra **SQL Editor → New query**. Não crie outro banco e não apague dados.

1. Se as migrações 1–8 já estão aplicadas, abra no GitHub [20261105000900_native_experience.sql](../supabase/migrations/20261105000900_native_experience.sql), botão **Raw**, copie o conteúdo inteiro, cole em uma consulta nova e clique **Run**. Acrescenta figurinhas e fila/dispositivos nativos privados.
2. Em outra consulta, repita com [20261105001000_private_calls.sql](../supabase/migrations/20261105001000_private_calls.sql). Acrescenta sinalização e permissões das chamadas.
3. Se alguma anterior estiver faltando, aplique as migrações restantes em ordem antes destas. Não execute `supabase/tests`, dados fictícios ou o script de testes no projeto hospedado.

As migrações anteriores ficam intactas. Contas/convites existentes continuam sujeitos às mesmas regras de Auth/RLS. Estas duas migrações não criam cadastro público nem promovem usuários.

## 2. Configurar notificações nativas (uma vez)

O Web Push/VAPID existente pertence ao site/PWA. O APK usa **Firebase Cloud Messaging**, que requer seu próprio projeto/configuração.

1. Abra [Firebase Console](https://console.firebase.google.com/), crie ou escolha um projeto exclusivo do MenChat e use **Adicionar aplicativo → Android**.
2. Nome do pacote Android: **`app.menchat.android`**. Nome de exibição: MenChat. Se pedir SHA-1, este fluxo FCM não depende de login Google; não invente uma impressão. A impressão SHA-256 pública da assinatura está em `public/.well-known/assetlinks.json`.
3. Baixe `google-services.json` para uma pasta **fora do repositório**. Não precisa colocá-lo no código: o APK recebe os campos públicos por HTTPS do servidor. No arquivo, localize o bloco `client` cujo `android_client_info.package_name` é `app.menchat.android`.
4. Em [Vercel → projeto men-chat](https://vercel.com/dashboard) → **Settings → Environment Variables → Add Environment Variable**, adicione estes valores em **Production** (e Preview somente se for testar esse ambiente):

| Nome na Vercel | Onde encontrar no JSON |
| --- | --- |
| `MENCHAT_FIREBASE_APP_ID` | `client[].client_info.mobilesdk_app_id` do pacote correto |
| `MENCHAT_FIREBASE_PROJECT_ID` | `project_info.project_id` |
| `MENCHAT_FIREBASE_SENDER_ID` | `project_info.project_number` |
| `MENCHAT_FIREBASE_API_KEY` | `client[].api_key[].current_key` do mesmo aplicativo |

Esses quatro campos identificam o aplicativo Firebase e serão públicos. Revise as restrições da API key no Google Cloud para o aplicativo/serviços Firebase necessários; não use uma chave de servidor neste campo.

5. Firebase → engrenagem **Configurações do projeto → Contas de serviço → Gerar nova chave privada**. Guarde o JSON baixado fora do GitHub. Na Vercel, adicione **somente como variáveis do servidor**, sem `NEXT_PUBLIC_`:

| Nome na Vercel | Campo da conta de serviço |
| --- | --- |
| `MENCHAT_FIREBASE_CLIENT_EMAIL` | `client_email` |
| `MENCHAT_FIREBASE_PRIVATE_KEY` | `private_key` inteira, incluindo BEGIN/END; aceita quebras reais ou `\n` do JSON |

A conta deve pertencer ao mesmo projeto e ter permissão para enviar pelo **FCM HTTP v1** (Firebase Cloud Messaging API habilitada). Não use chave legada, não coloque o JSON no APK, não envie esses valores na conversa. Preserve `SUPABASE_SECRET_KEY` já usada para convites.

6. Vercel → **Deployments → último deployment → ⋯ → Redeploy**. Variáveis novas só passam a valer em um novo deployment.
7. Preserve/configure a retomada de fila descrita no [guia de notificações](android-e-notificacoes.md#ativar-notificações-com-o-app-fechado): `MENCHAT_PUSH_CRON_SECRET` na Vercel, mesmo valor no Supabase Vault `menchat_push_cron_secret`, executar `supabase/setup-push-scheduler.sql` uma vez. A rota de agendamento entrega as filas web e Android; VAPID só é necessário para a fila web.
8. Abra novamente o APK → **engrenagem → Notificações → Ativar com o app fechado** → permita no Android. Repita nos aparelhos desejados, até cinco dispositivos nativos por conta. **Testar notificação** verifica o canal local; somente receber um aviso enviado de outra conta comprova o caminho FCM.

Avisos de fundo mostram mensagem genérica, sem nome, texto ou mídia. Ao tocar, o app revalida sessão e participação antes de abrir a conversa. Sair da conta desassocia o dispositivo e revoga sua sessão de push. O som respeita canais, volume, Não Perturbe e escolhas do Android; não recriamos canais para desfazer o silêncio definido pelo usuário. “Forçar parada” e políticas de bateria podem bloquear avisos até reabrir. No Poco/HyperOS, confira também permissões de notificação, execução em segundo plano e economia de bateria do MenChat.

## 3. Configurar chamadas (uma vez)

É necessário um **servidor TURN com autenticação REST temporária HMAC-SHA1**, por exemplo coturn em um servidor próprio. STUN sozinho falha em parte das redes móveis. A Vercel hospeda a aplicação/sinalização HTTP, mas não hospeda o servidor UDP/TURN. O projeto não provisiona um servidor externo automaticamente.

Peça ao provedor/administrador do TURN estes dados: domínio, portas/transporte e **segredo compartilhado REST** com pelo menos 32 caracteres. No coturn, correspondem a `use-auth-secret` e `static-auth-secret`; configure realm, certificado TLS válido, portas de escuta e intervalo de retransmissão no firewall. Bloqueie acesso a redes privadas/loopback conforme a configuração oficial do provedor. Não use credenciais estáticas de exemplo nem um servidor aberto.

Vercel → Settings → Environment Variables → Production:

| Nome | Valor/formato |
| --- | --- |
| `MENCHAT_TURN_URLS` | Array JSON de URLs reais, por exemplo `["turn:turn.seu-dominio.com:3478?transport=udp","turns:turn.seu-dominio.com:5349?transport=tcp"]` |
| `MENCHAT_TURN_SECRET` | Segredo REST do mesmo servidor, somente no backend |

Faça **Redeploy** e reabra o app. Nenhum APK novo é necessário apenas para mudar esses valores. Clientes autenticados recebem credenciais individuais com validade de 20 minutos, renovadas durante a chamada; o segredo permanente nunca vai ao cliente. O banco controla membros/dispositivos, convites de 45 segundos, atividade, exclusão da sinalização ao encerrar e limite de quatro pessoas. A mídia WebRTC não é gravada no Supabase Storage.

Na conversa, use **Chamada de voz/vídeo** (Android: ações do cabeçalho). Aceite microfone/câmera somente ao iniciar/atender. A chamada já atendida usa notificação/serviço Android enquanto ativa; um push recebido não liga câmera ou microfone sozinho. Recebimento com APK fechado depende também do FCM do passo 2. A web precisa ficar aberta para receber chamada; o Web Push existente não oferece tela de chamada do sistema. Chamadas em grupo incluem os membros presentes no convite inicial; não há entrada automática de quem entrar no grupo depois.

## 4. Atualizar e conferir em aparelhos reais

Após SQL e deployment, baixe pelo site **Baixar app Android → versão 3.0.0**. Instale sobre 2.2.0. Se o site ainda oferecer a anterior, confira o deployment publicado; não desinstale para contornar erro de assinatura.

Com duas contas autorizadas, teste:

1. Abrir privado/grupo, enviar texto, áudio curto, foto/câmera, vídeo e documento; fechar/reabrir e comparar o histórico web/Android.
2. Criar grupo, promover membro, remover membro comum e confirmar bloqueio do criador; transferir propriedade e sair. Conferir perda de acesso de quem foi removido.
3. Editar foto/nome/status/privacidade, responder mídia/texto, marcar/desmarcar, mencionar e enviar figurinha recortada.
4. Trocar claro/escuro/sistema, texto grande, teclado/rotação; testar prévias com economia de dados e velocidades do áudio.
5. Ouvir toque, permitir aviso e receber mensagem com app fechado; tocar na notificação, silenciar conversa, desligar som, sair da conta e confirmar ausência de novos avisos.
6. Voz e vídeo entre web/Android e Android/Android, Wi-Fi/rede móvel, duas e até quatro pessoas; recusar, negar permissão, silenciar, trocar câmera/saída, minimizar, bloquear a tela, sair/remover do grupo e encerrar. Conferir indicadores do Android apagando ao terminar.
7. Interromper/restaurar rede durante envio/chamada e conferir reenvio sem duplicação; verificar qualidade/bateria antes de ampliar distribuição. P2P não garante quatro vídeos fluidos em qualquer aparelho/rede.

## Verificações do desenvolvimento

`npm run lint`, `typecheck`, `npm test`, `test:db`, `test:e2e` e `test:real-ui`; Gradle `:nativeApp:testDebugUnitTest` e `:nativeApp:assembleRelease`. A suíte de chamadas usa transporte de banco fictício e **PeerConnection/RTP reais do Chromium**, com TURN descartável local em Docker. Não usa credenciais de produção. A suíte Android usa Robolectric/Compose e mídia de chamada substituída em testes de ciclo de vida, não hardware/JNI real. Há cobertura de cancelamento/permissão tardia, erros, remoção, grupos e isolamento de chamadas por conta/dispositivo. Testes locais não comprovam FCM, TURN público, SMTP ou câmera/chamada no Poco.

Código: `android/nativeApp/.../NativeSettings.kt`, `NativeGroups.kt`, `NativeCollections.kt`, `NativeStickers.kt`, `NativePush.kt`, `NativeCalls.kt`, `NativeRtc.kt`; servidor em `lib/native-push`, `lib/calls`, `lib/mobile` e `app/api/mobile`; web em `components/chat/real/calls.tsx`; migrações 9–10. Som original sintetizado para o projeto: `res/raw/menchat_ping.wav` e `public/audio/menchat-ping.wav`.

Para compilar: JDK 21, SDK 36/Build Tools 36.0.0, `ANDROID_HOME` e chave de assinatura original pelas variáveis privadas descritas no [guia nativo](android-nativo-etapa-1.md). Use **`:nativeApp:assembleRelease`**, não `:app:assembleRelease` (TWA legado). Release em `android/nativeApp/build/outputs/apk/release/nativeApp-release.apk`, versionCode 8. Confira certificado, manifesto/permissões e alinhamento ELF/ZIP 16 KB antes de publicar. Nunca versione keystore, senhas, JSON de conta de serviço ou URLs autenticadas.

## Capturas dos testes de interface

[Aparência em celular pequeno](images/android-3-appearance.png) · [Notificações](images/android-3-notifications.png) · [Administração do grupo](images/android-3-group.png). São capturas Compose/Robolectric com participantes fictícios; não exibem contas reais.

Resultado desta entrega: lint sem avisos, tipos e build web aprovados; **61 testes Node, 70 Android/Robolectric, 39 da suíte web oficial e 48 de interface passaram**. PostgreSQL descartável aprovou migrações, isolamento/privacidade, cota, concorrência, figurinhas, revogação FCM e chamadas. Release verificado com assinatura original, versionCode 8, manifesto sem depuração, serviços/provedor protegidos, ZIP alinhado em 16 KB e bibliotecas de 64 bits compatíveis com páginas de 16 KB. APK universal de 58,7 MB, quatro ABIs, com [checksum SHA-256](../public/downloads/menchat-3.0.0.apk.sha256). Firebase/TURN e testes físicos da 3.0 continuam dependendo dos passos acima; nenhum desses resultados locais comprova ativação hospedada.
