# MenChat

Aplicativo privado de mensagens para até 20 amigos e familiares, com acesso exclusivo por convite. Web responsiva e PWA instalável, com foco em Android. Publicação: https://men-chat.vercel.app.

## Recursos

- Login, convites vinculados ao e-mail, OTP independente e código pessoal automático.
- Conversas privadas e grupos, administradores, proprietário e proteção do criador.
- Fotos, vídeos, documentos e áudios privados, prévias e gravação com dois cliques.
- Câmera para foto/vídeo, imagens ampliáveis e áudio com controles simplificados.
- Respostas com contexto, mensagens marcadas por conta e menções a participantes do grupo.
- Perfil com nome, status, foto e opções de privacidade.
- Indicadores de digitação/leitura, contador privado de não lidas e exclusão para mim/todos.
- Temas, preferências de mídia/voz/avisos, carregamento com a marca e instalação no Android.

## Executar localmente

Node.js 24 LTS, npm e Git. Na pasta com `package.json`:

```bash
npm ci
npm run dev
```

No Git Bash do Windows, se necessário, use `npm ci --cache "$LOCALAPPDATA/npm-cache"`. Abra `http://127.0.0.1:3000`, ou a porta indicada no terminal. Para uma versão compilada, execute `npm run build` e `npm start -- --hostname 0.0.0.0 --port 3001`.

Copie `.env.example` para `.env.local` e preencha URL/chave publicável do seu Supabase. Chave secret somente no servidor, para convites; nunca use `NEXT_PUBLIC_` para ela. Não versione `.env.local` ou compartilhe senhas/chaves. O cadastro público do Supabase permanece desativado.

## Banco e publicação

Migrações em `supabase/migrations/`, versões 1–11, aplicadas uma vez em ordem. Preserve arquivos já aplicados; mudanças posteriores usam novas migrações. Primeiro administrador é definido pelo proprietário, sem endpoint público de bootstrap.

Guias:

- [Android 3.0.1 — prévias e vibração de chamadas](docs/notificacoes-3.0.1.md).
- [Android 3.0 — recursos, submenus, som, Firebase e chamadas](docs/android-3.0.md).
- [Primeiro acesso administrativo](docs/primeiro-acesso-real.md).
- [Configuração única de convites](docs/convites-pelo-aplicativo.md).
- [Grupos, Storage e perfil — migração 5](docs/chat-completo.md).
- [Android 2.2 — câmera, anexos e perfil](docs/android-midia-perfil-2.2.md).
- [Android 2.1 — nova interface nativa](docs/android-interface-2.1.md).
- [Android nativo Kotlin — etapa 1](docs/android-nativo-etapa-1.md).
- [Roteiro de paridade Android/web, notificações e chamadas](docs/roteiro-paridade-android.md).
- [APK Android e push — migração 8](docs/android-e-notificacoes.md).
- [App oficial e Android — migração 6](docs/app-oficial.md).
- [Mídia, câmera, respostas e navegação — migração 7](docs/refinamentos-chat.md).

Rotas principais: `/entrar`, `/conta/chat`, `/conta/perfil`, `/conta/configuracoes`, `/conta/convites` (administrador) e `/convite`. Endereços antigos encaminham para o app oficial; dados fictícios não fazem parte da navegação.

## Instalar no Android

Abra a publicação HTTPS no Chrome e use ⋮ → Instalar aplicativo / Adicionar à tela inicial. O MenChat também mostra um botão de instalação quando o navegador permitir. O app instalado exige internet; o worker não armazena conversas, tokens ou anexos em Cache Storage. O botão **Baixar app Android** oferece o APK Kotlin 3.0.2 e a alternativa PWA. O nativo não usa Chrome/WebView. Inclui grupos, mídia/câmera, perfil, favoritos, menções, emojis/figurinhas, configurações em submenus e som próprio. Push Android e chamadas WebRTC web/Android estão implementados, mas dependem de migrações 9–10; chamadas diretas usam STUN por padrão, TURN é opcional e push Android exige Firebase; consulte o [guia 3.0](docs/android-3.0.md). Não foram ativados ou validados nas contas hospedadas por esta entrega. Instale sobre a versão anterior, preservando a assinatura. Ainda não há publicação na Play Store.

## Privacidade e limites

Auth validado no servidor, RLS, buckets privados e URLs temporárias. Não há criptografia ponta a ponta. Grupo novo/readmissão permite histórico completo; saída/remoção encerra consultas. URLs já emitidas podem funcionar por até 5 minutos; cópias baixadas permanecem com o destinatário.

Fotos até 5 MB, vídeos 25 MB, áudios/documentos 10 MB, uma mídia por mensagem. Reservas: 100 MB por pessoa em 24 horas, cinco pendentes por hora e 500 MB globais. Perfil normaliza foto de até 2 MB para 256 px/200 KB. As cotas do plano Supabase e seu tráfego são adicionais aos limites do app.

Apagar para todos fica disponível ao autor e retira o conteúdo servido no histórico. Objetos físicos/reservas aguardam limpeza administrativa; não há limpeza automática agendada nem liberação imediata de espaço. Planejar retenção e backup antes de ampliar a distribuição.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:e2e
npm run test:real-ui
npm run test:dev
```

`test:db` usa Docker/PostgreSQL descartável; `test:e2e` também exige Docker para TURN local descartável (chamadas com RTP real); nunca execute fixtures de `supabase/tests` no projeto hospedado. Testa permissões, cota, grupos, mensagens, mídia e concorrência. Não emula Auth/SMTP/Storage HTTP reais.

Playwright: `npx playwright install chromium`. Na nuvem, prefixe os comandos com `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Execute as suítes sequencialmente, deixando portas 3100/3102/3106 livres.

A suíte oficial cobre rotas protegidas, convites, manifesto e worker. `test:real-ui` usa serviços fictícios isolados em `menchat.invalid`, câmera/microfone sintéticos, desktop/celular/320 px. Testa também câmera, reprodução, ampliação, respostas, menções, marcações e preservação de rascunho ao abrir configurações. Testes legados do protótipo permanecem arquivados, fora da seleção oficial. Testes locais não substituem a conferência no Supabase hospedado e em Android físico.

Stack: Next.js App Router, React, TypeScript, Tailwind, Supabase e npm. Origem: template oficial Next.js `with-supabase`.
