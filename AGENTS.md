# Diretrizes do M&N CHAT

## Produto e escopo

- Aplicativo privado para até 20 amigos e familiares, exclusivamente por convite do administrador.
- Trabalhe em etapas pequenas e verificáveis. Implemente apenas a etapa solicitada e pare ao concluí-la.
- Etapa atual: app oficial protegido, com grupos/mídia/perfil (migração 5), PWA e exclusão/não lidas (6), respostas/menções/favoritos e refinamento da mídia/navegação (7). A navegação do protótipo foi aposentada. Orientações históricas abaixo sobre demonstrações descrevem etapas anteriores; prevalecem as seções atuais das migrações 5–7. Não assumir que uma migração nova foi aplicada no projeto hospedado sem confirmação; testes locais não comprovam Auth/SMTP/Storage hospedados nem câmera física.
- Interface e textos em português do Brasil; marca atual MenChat. Login minimalista, somente marca/formulário/ações, com animação que respeita redução de movimento.

## Stack e organização

- Node.js 24 LTS, npm, Next.js estável com App Router, React, TypeScript estrito e Tailwind CSS.
- `app/`: rotas, metadados e layout; `components/`: componentes; `lib/data/`: dados fictícios; `types/`: tipos de domínio; `tests/`: testes Node/Playwright; `lib/supabase/`: clientes SSR e renovação de sessão das rotas reais.
- Prefira Server Components. Use `"use client"` somente para estado e eventos de interface.
- Use as APIs oficiais atuais do Next.js e Supabase. Mantenha `package-lock.json` atualizado pelo npm e use `npm ci` para reproduzir instalações.
- Preserve o Git existente; use o checkout da tarefa. Não crie worktrees a menos que o usuário peça.

## Segurança

- Cadastro real permanece exclusivo por convite. `/cadastro` cria apenas perfil local de demonstração, com convite de teste AMIGOS20. Não transforme isso em controle de acesso real.
- Não registre senhas, tokens ou dados de formulário. Não grave segredos no repositório.
- Somente URL e chave publicável do Supabase podem usar `NEXT_PUBLIC_`. Chaves administrativas/secretas nunca podem estar no cliente.
- A integração Auth/SSR foi autorizada para as rotas reais novas. Preserve renovação de sessão no servidor, validação de identidade e RLS. Texto privado e convites operacionais são autorizados; a etapa de grupos/mídia/perfil foi autorizada; PWA é posterior.
- /login, /cadastro, /perfil, /conversas e /configuracoes são demonstrações públicas; /conta é protegida no servidor por identidade validada e perfil ativo. Perfil, tema e preferências ficam no armazenamento local, sem e-mail ou senha; mensagens, grupos e anexos são temporários na memória da aba. Respostas automáticas devem ser identificadas como simulação. Não prometa segurança, privacidade operacional ou criptografia ponta a ponta ainda não implementadas.

## Interface e validação

- Layout responsivo, HTML semântico, rótulos nos campos, foco visível, navegação por teclado e alvos de toque adequados.
- No desktop, mantenha usuários/grupos fixos à esquerda e a conversa preenchendo todo o espaço restante até a borda direita, sem limitar a largura da área principal. No celular, alterne entre lista e conversa. Engrenagem e clipe devem estar visíveis; o campo de mensagem tem largura moderada. Configurações devem ter efeito real ou informar a limitação.
- Gravação começa no clique do microfone e a seta envia diretamente; ouvir antes é opcional, sem confirmação de anexo obrigatória. Use MediaRecorder mediante ação e permissão explícitas. Libere streams ao parar, sair ou cancelar, inclusive se a permissão resolver depois do fechamento. HTTP na rede local não oferece gravação; mantenha a opção de anexar áudio.
- Notificações de sistema só pedem permissão por botão, exigem contexto seguro e não são push com o app fechado. Download automático controla prévias, nunca salvamento em disco sem ação. Não prometa suporte móvel universal.
- Perfis, visibilidade do código, leituras e digitação são demonstrações; filtre os participantes da conversa, respeite as opções locais e identifique as simulações. Nunca apresente filtros do frontend como autorização real.
- Convites reais deverão exigir e-mail vinculado e verificação independente na aceitação, além de uso único atômico, validade e revogação. Um link de uso único sozinho pode ser repassado antes de usado. Consulte docs/convites-e-privacidade.md; a etapa de convites operacionais está autorizada; mantenha os controles no servidor e no banco.
- Grupos têm criador imutável, dono e administradores separados. Nunca permita remoção ou rebaixamento do criador por outro, inclusive após transferência. O dono transfere antes de sair se houver outros membros; quem saiu não envia ou administra. Convite por código adiciona apenas perfil já existente na demonstração; não cria acesso ao aplicativo.
- Identifique dados fictícios e funcionalidades indisponíveis; evite controles que pareçam executar ações reais.
- Antes de concluir: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, `npm run test:e2e` e smoke test das páginas e interações em desktop e celular quando houver navegador disponível.
- Ao alterar configuração do Next ou acesso pela rede local, execute também `npm run test:dev` (porta 3102; pare outro servidor dev deste checkout). Preserve a raiz explícita do Turbopack e a lista de origens restrita aos endereços da própria máquina.
- Informe arquivos alterados, verificações, limitações e o que ficou fora da etapa. Não avance automaticamente.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Emojis e figurinhas

- Mantenha o seletor de emojis acessível no compositor; inserir no cursor preserva o rascunho. Figurinhas são imagens com `sticker: true`, respeitam preferências de prévias de fotos e são enviadas individualmente.
- A coleção fica no IndexedDB, limitada a 40 itens. Normalize imagens locais para WebP estático de 512 × 512 e até 100 KB; não prometa integração com pacotes WhatsApp, remoção automática de fundo ou animação. Preserve transparência e trate falhas de armazenamento. Nenhum upload nesta etapa.

## Próximas integrações e bolas de neve

- Roteiro autorizado: `docs/integracao-e-celular.md`. O usuário quer iniciar a integração em etapas. Sem projeto de teste configurado, prepare o roteiro, sem presumir credenciais ou provisionar serviços. Revalidar guias oficiais na implementação; não ativar rotas com dados reais sem Auth/RLS.
- Bola de neve: uma vez por pessoa em cada conversa. Protótipo em memória, sem alertas ao reabrir histórico; futuro banco deve garantir unicidade por conversa/remetente. O teste mostra recebimento local, não entrega remota. Respeitar notificações, silenciamento, redução de movimento e opções de vibração/animação; não prometer vibração em Safari/iPhone ou em segundo plano.
- Recorte deve salvar os mesmos ajustes da prévia. Confirmação de remoção de grupo deve ficar visível e receber foco; preserve as regras do criador e dos administradores.

- Integração iniciada pela configuração pública e `npm run supabase:check`. O teste é somente leitura do Auth e exige cadastro público bloqueado; não equivale a validar PostgreSQL/RLS. Conexão confirmada pelo usuário; base de perfis/convites em supabase/migrations, com aplicação manual no SQL Editor. Executar npm run test:db ao alterar SQL. Guia: docs/banco-inicial.md. Primeiro acesso administrativo: docs/primeiro-acesso-real.md. Texto privado e aceite atômico de convites para amigos estão implementados em migrações posteriores; consulte os guias específicos.

## Acesso real

- /entrar, /primeiro-acesso e /conta usam Auth real; rotas antigas são demo. Não converter uma falha de Auth em acesso demo ou privado. Validar getUser no servidor e perfil próprio ativo por RLS em cada recurso protegido.
- Proxy SSR mantém cookies e cabeçalhos privados/no-store. Não armazenar cliente Supabase global entre requisições. Senha e OTP nunca entram em logs, URLs ou armazenamento local da aplicação.
- Cadastro público permanece bloqueado. OTP usa shouldCreateUser:false para identidades administrativamente provisionadas e confirmadas no Auth, sem criar perfil/ativar membros. Apenas após verificar o código o fluxo redefine a senha.
- Primeiro administrador é escolhido manualmente pelo proprietário no SQL Editor (setup-owner.sql), após o OTP independente. Auto Confirm do painel é provisão administrativa, não prova de posse do e-mail; não confundir isso com verificação de convite. Não promover primeiro visitante nem expor endpoint de bootstrap público.
- Migrações aplicadas são imutáveis. 20261104000200_profile_accounting corrige a contagem para AFTER e repara divergências anteriores de upsert. Executar test:db ao alterar SQL, incluindo repetição e concorrência.

## Texto privado real

- `/conta/chat` usa sessão validada e RLS; `/conversas` continua demo. Não confundir canal “Ao vivo” com presença de usuários.
- Migração 20261104000300_private_chat: exatamente dois participantes fixos, somente texto, sem edição/exclusão; admins não leem privados alheios. Manter limites de busca no banco e idempotência dos envios.
- Grupos/mídia/recibos reais usam a migração 5; não afirmar presença online contínua. Testar no Postgres e em duas contas hospedadas antes de anunciar entrega ao vivo validada.

## Convites operacionais e próximas etapas

- Guia: `docs/convites-pelo-aplicativo.md`; etapas: `docs/etapas-avancadas.md`. Concluir uma entrega por vez, sem avançar automaticamente.
- Migração 4: administrador ativo gera/revoga; servidor provisiona Auth sem senha/sessão; perfil só é ativado como membro após OTP independente recente, identidade/e-mail coincidentes, token válido não consumido. Limite atômico de 20 contas/reservas, validade 72h, reemissão revoga anterior.
- `SUPABASE_SECRET_KEY` somente em módulo `server-only`, sem `NEXT_PUBLIC_`; validar administrador na Action antes de usar Admin API e novamente na RPC de mutação. Preparo limitado a 30 tentativas/admin/hora antes do provisionamento Auth. Contas antigas não confirmadas não são promovidas automaticamente.
- Link usa fragmento; token sai do endereço após leitura e fica na memória da página, nunca em logs/storage do app. Banco guarda só SHA-256, mas aceite exige token original, não seu hash. Não transmitir segredo administrativo para o cliente.
- Auth e banco não são uma transação: falha/revogação após OTP não pode conceder perfil ativo; não apagar automaticamente identidades após falhas ambíguas. Testar concorrência e negação para membro/anônimo, JWT sem OTP recente, e-mail divergente, expiração, revogação e repetição.

## Experiência real completa — migração 5

- O usuário quer concluir visual, grupos, anexos, voz e perfil antes de convidar novas pessoas. Não condicionar o teste solo a convites; grupos podem ter apenas o criador.
- Guia `docs/chat-completo.md`. Migração 5 é incremental; não alterar migrações publicadas. Bucket privado, reserva no banco, confirmação do objeto antes de publicar, upload sem sobrescrita; exclusão/publicação e saída/envio concorrentes devem preservar integridade.
- Limites: foto 5 MB, vídeo 25 MB, áudio/documento 10 MB; uma mídia por mensagem. Avatar 256 px/200 KB após normalizar foto original até 2 MB. Reserva 100 MB/pessoa/dia, cinco pendentes/hora e 500 MB globais. URLs assinadas expiram em 5 minutos; documentar janela de revogação e necessidade de limpeza de órfãos.
- Membros saídos/removidos perdem histórico e mídia; entrada/readmissão permite histórico completo. Criador imutável, dono transfere antes de sair com outros membros, admins do app não têm leitura global.
- Digitação/recibos vêm do banco com preferências reais; expiração 6 s, consulta 3 s. Marcar leitura somente com aba focada/visível e fim do histórico. Não confundir gravado no servidor com recebido/lido. Confirmações consideram participantes atuais.
- `test:real-ui` usa processo/domínio falsos exclusivos de teste, sem bypass no app. Não usar mocks para afirmar sucesso do Supabase hospedado. Executar suítes de navegador sequencialmente, pois dois next dev do checkout compartilham saída.

## App oficial — migração 6

- Rotas do protótipo foram aposentadas e redirecionam para o app protegido. Não remover avisos para fazer dados fictícios parecerem reais. Suíte oficial Playwright exclui os testes legados, preservados no repositório.
- PWA Android: manifesto, PNGs e worker somente rede; nenhuma conversa, token ou mídia em Cache Storage. Não prometer offline privado ou push.
- Exclusão para todos somente pelo autor; apagadas mantêm tombstone e deixam de autorizar mídia. Para mim é persistente por usuário. Cópias e URLs já emitidas não podem ser recolhidas; arquivos físicos aguardam limpeza administrativa.
- Contador privado de vistas separado de read_receipts; contato do convidador somente ao membro autenticado, respeitando show_code/allow_code_lookup.
- Guia atual: docs/app-oficial.md. Aplicar a migração 6 e validar em Android físico antes de afirmar instalação hospedada confirmada.

## Refinamentos do chat — migração 7

- Guia `docs/refinamentos-chat.md`. Preservar migrações publicadas 1–6. Envios compostos validam resposta visível da mesma conversa e menções por ID a membros ativos do grupo; manter idempotência incluindo contexto. Nunca armazenar cópia do texto respondido que sobreviva à exclusão/ocultação da fonte.
- Marcações são favoritas privadas por conta; listar as últimas 200 visíveis e não apagadas. Autorizações ficam no banco, inclusive quando chamadas fora da interface.
- Áudio com controles próprios e download; fotos ampliáveis, sem nome de arquivo no balão. Não reintroduzir reload manual. Manter descarte de streams/URLs e reprodução estável durante a sincronização.
- Câmera pede permissão por ação, captura foto/vídeo para o rascunho e libera dispositivos ao fechar, concluir ou falhar, inclusive permissões que resolvem após o fechamento. HTTPS e navegador compatível; seletor de arquivos como alternativa. Vídeo capturado até 2 minutos/25 MB, foto até 5 MB.
- Perfil/configurações podem abrir sobre o chat, preservando rascunhos; endereços diretos continuam protegidos por getUser e perfil próprio ativo. Evitar novas consultas de página ao abrir preferências, confirmações repetidas e downloads de mídia causados apenas pelo polling. Não marcar como lidas mensagens atrás de um menu aberto.
- `test:real-ui` usa câmera/microfone sintéticos; não afirmar validação de dispositivos Android ou latência da produção a partir do mock. Digitação no histórico respeita preferências reais e expiração.

## Android e push — migração 8

- O usuário autorizou APK no site e notificações com o app fechado. Projeto `android/` usa Android Browser Helper/TWA sobre o domínio HTTPS, API 26–36, assinatura release própria. APK em `public/downloads/`; impressão pública em `public/.well-known/assetlinks.json`. Nunca versionar keystore/senhas; backup privado entregue ao proprietário é indispensável para futuras atualizações. Não prometer chamadas, offline privado ou Play Store.
- Guia `docs/android-e-notificacoes.md`; fila/dispositivos privados, endpoints e chaves nunca retornam a membros. Push genérico sem nome/texto/mídia/sessão. Autor autenticado aciona somente sua fila; cron exige segredo separado e consulta atual de participação/silenciamento. Lease, três tentativas, expiração em 24 horas. Aceitar somente serviços oficiais de push, sem porta/credenciais.
- VAPID/cron configurados uma vez na Vercel; segredo cron também no Supabase Vault. Não afirmar ativação hospedada sem evidência. Validar domínio, permissões e entrega em Android físico.
- Menu é popover local, seta no canto superior direito; preservar histórico, Escape, foco e respostas a texto/mídia. Download visível na lista/login, com instruções mesmo sem beforeinstallprompt.

- Android 1.0.1: declarar ManageDataLauncherActivity, manageSpaceActivity e MANAGE_SPACE_URL. O helper a habilita na abertura; omissão causa IllegalArgumentException em dispositivo real. Executar ./gradlew testDebugUnitTest (Robolectric Android 15/16), assembleRelease e conferir o manifesto do APK final, certificado e versionCode. Nunca substituir assinatura nem pedir desinstalação para atualizar. Links da versão quebrada no site redirecionam para a corrigida.

## Android nativo — etapa 1 (2.0.0)

- O usuário escolheu delegar a melhor alternativa para não abrir o Chrome. Foi escolhida migração nativa Kotlin/Compose em etapas; esta entrega cobre login, conversas, texto e áudio, preservando a web e documentando recursos ainda não migrados. Não chamar WebView de interface nativa.
- Novo módulo `android/nativeApp`, mesmo applicationId/assinatura, versionCode 3. Alias antigo de lançamento aponta à NativeActivity, preservando atalhos; nenhum TwaLauncher/Browser Helper entra nesse APK. `android/app` é legado TWA, não o módulo publicado como 2.0.0.
- Guia `docs/android-nativo-etapa-1.md`. `/api/mobile/config` retorna somente URL/chave publicável, sem autenticar conta; getUser remoto e perfil próprio ativo são obrigatórios no cliente antes de liberar as telas. RLS governa cada consulta/mutação. Senha só em memória; tokens no Android Keystore/AES-GCM, nenhum segredo administrativo no APK. Respeitar renovação antes de autenticar solicitações.
- Não prometer notificações nativas com app fechado: Web Push pertence ao site; FCM/notificações Android exigem etapa própria. Não avançar automaticamente para essa integração ou fingir paridade completa.
- `:nativeApp:testDebugUnitTest` verifica contratos HTTP e Activity Kotlin em Robolectric Android 15/16; `:nativeApp:assembleRelease`, verificar certificado, versionCode, manifesto e alinhamento ELF/ZIP de 16 KB. Testes simulados não substituem validação no Poco físico.

- Android 2.0.1 (versionCode 4): histórico autorizado aparece antes dos participantes/recibos; falhas auxiliares não bloqueiam a conversa. Erros exibem operação/categoria/códigos HTTP e lista restrita de códigos PostgREST/SQL, nunca corpo remoto, token, URL ou ID. Limpar histórico ao receber 401/403 na consulta do histórico e descartar falha de conversa/conta antiga. Testar falhas HTTP/formato, perda de participação e corrida de seleção. Não atribuir aviso genérico de sincronização às chaves VAPID nem afirmar causa hospedada confirmada a partir de um teste simulado.

- Roteiro autorizado pelo usuário: `docs/roteiro-paridade-android.md` (estabilidade, UI baseada na web, câmera/perfil/paridade, som/push nativo e chamadas WebRTC P2P privadas/grupo). Entregar por etapas verificáveis; não afirmar app completo ou livre de falhas sem comprovação. Entrega 2.0.2: filtro PostgREST sempre `in.(...)`, teste estrito de URL real, duração web por amostras decodificadas ao ouvir (até 10 MB; sem rebaixar reprodução se não verificar). Não confiar em duração de cabeçalho nem baixar/decodificar novamente por polling.

- Android 2.1.0/versionCode 6: reboot visual da etapa 2. Guia `docs/android-interface-2.1.md`. Componentes em NativeDesign/Inbox/Chat/Media; NativeScreens mantém estado/sessão/ações reais. Paleta igual à web, dois painéis a partir de 840 dp, ícones nativos em traço, menu ancorado e microfone à direita. Testes Compose/Robolectric com dados fictícios só no código de testes; manifesto ui-test-manifest é debugImplementation, nunca release. Não adicionar botões de câmera/anexo/chamada sem implementar a ação real da etapa correspondente. Preservar cobertura de leitura atrás de menus e vínculo da permissão do microfone à conversa ativa.

- Android 2.2.0/versionCode 7 — etapa 3A: câmera Android por Activity Result/FileProvider somente em cache/menchat-capture, galeria privada e documentos; nenhuma permissão ampla de armazenamento nem CAMERA (a captura é da aplicação de câmera do sistema). Validar retorno por conta/conversa, duração/tamanho real e liberar concessões temporárias. NativeLocalMedia normaliza avatar 256 px/200 KB e fotos capturadas, aplica orientação EXIF e remove metadados; galeria original de perfil até 2 MB. NativePreview pausa vídeo ao sair e libera player ao fechar. Guia: docs/android-midia-perfil-2.2.md.
- Envio nativo mantém ID/conteúdo/reserva no reenvio em memória. Resposta ambígua congela alterações e confirma a mensagem antes de republicar, sem novo upload de objeto já publicado. Descartar tentativa não é apagar mensagem. Perfil preserva flags de privacidade falsas e reaproveita avatar após falha; só tenta limpar a foto anterior após salvar/confirmar a nova. Buckets privados e RPCs/RLS existentes, sem nova migração ou segredo no APK. Não confirmar leitura atrás de perfil, seletores ou visualizadores.
- Na entrega 2.2, etapa 3B, FCM/som e WebRTC ainda estavam pendentes; a seção 3.0 abaixo documenta a implementação posterior. Não anunciar paridade completa ou validação do Poco/Supabase a partir de testes locais. Manter assinatura, alias e conferir APK release; fixtures Compose/HTTP permanecem somente em testes.

## Android 3.0/versionCode 8 — entrega restante autorizada

- O usuário autorizou concluir a atualização com configurações, grupos/convites, favoritos/menções/emojis/figurinhas, som/FCM e chamadas. Guia atual: `docs/android-3.0.md`. 2.2.0 foi testada no Poco pelo usuário; não transferir essa evidência para o APK novo. Preserve pacote/assinatura/atalho e atualize sobre a versão anterior. Legado TWA não é o módulo distribuído.
- Migrações 9–10 acrescentam figurinhas, fila/dispositivos FCM e chamadas. Nunca alterar 1–8. SQL local não comprova aplicação hospedada. Sem Firebase/TURN configurados, mostrar indisponibilidade real; não esconder a dependência nem afirmar serviço ativo. PublicConfig entrega apenas campos públicos Firebase e flags, clientes exigem getUser/perfil ativo. Conta de serviço e segredo TURN ficam no servidor.
- FCM 26 usa registro por installation ID com `register`/`onRegistered`; sessão/dispositivo/lease privados e revogação contra renovação atrasada após logout. Aviso genérico sem conteúdo/nome/mídia. Som original, preferências e canais Android respeitam silêncio/DND. Worker valida sessão atual e perfil, nunca abre câmera/mic em fundo.
- WebRTC P2P: limite quatro, autorização por conversa/conta/dispositivo, TURN REST temporário, geração/nonce de sinalização, descarte de capturas/permissões tardias e buffers ICE. Sinalização removida ao encerrar e limitada por tamanho/tempo; nenhuma gravação da chamada. Serviço Android camera/microphone somente após ação visível/permissão. CAMERA agora é necessária para WebRTC; captura externa também deve pedir permissão antes de criar arquivo.
- Preferências nativas têm efeito real; coleção local por conta, WebP estático 512x512/100KB e limite40. Primeiro acesso/recuperação/aceite de convite usam web segura; não alegar onboarding inteiramente nativo.
- `test:e2e` exige Docker para TURN local descartável; usa WebRTC/RTP Chromium real com transporte de banco fictício. Android testa UI/lifecycle em Robolectric com mídia de chamada substituída; não afirmar teste físico/JNI. Conferir assinatura, manifesto seguro e ELF/ZIP16KB no release com WebRTC. Firebase/TURN público e validação entre aparelhos seguem a configuração do proprietário.

- Atualização autorizada: simplificar chamadas com WebRTC/STUN por padrão, sem TURN obrigatório. MENCHAT_CALLS_ENABLED=false permite desativar. TURN REST continua opcional; preservar autenticação, RLS e limite quatro. APK 3.0 recebe a configuração remota sem novo pacote. Não prometer conectividade em toda rede ou push sem Firebase.

- Android 3.0.1/code9: usuário autorizou nome/conteúdo resumido em notificações. Migração 11 fornece prévia somente ao servidor, revalida destinatário/visibilidade e mensagens apagadas. A prévia passa pelo FCM; controle nativo oculta a exibição e tela bloqueada segue Android. Chamadas têm canal separado de alta importância e pulsos longos, com silêncio/vibração do sistema respeitados, timeout 45s. Não afirmar intensidade física nem entrega de push a partir de Robolectric.
