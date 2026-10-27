# Diretrizes do M&N CHAT

## Produto e escopo

- Aplicativo privado para até 20 amigos e familiares, exclusivamente por convite do administrador.
- Trabalhe em etapas pequenas e verificáveis. Implemente apenas a etapa solicitada e pare ao concluí-la.
- Etapa atual: demonstração interativa com respostas automáticas locais. O usuário confirmou que quer testar telas e responsividade antes de liberar para pessoas reais. Não há autenticação real, convites reais, banco de dados ou PWA.
- Interface e textos em português do Brasil; marca atual MenChat. Login minimalista, somente marca/formulário/ações, com animação que respeita redução de movimento.

## Stack e organização

- Node.js 24 LTS, npm, Next.js estável com App Router, React, TypeScript estrito e Tailwind CSS.
- `app/`: rotas, metadados e layout; `components/`: componentes; `lib/data/`: dados fictícios; `types/`: tipos de domínio; `tests/`: testes Node/Playwright; `lib/supabase/`: fábricas oficiais ainda inativas.
- Prefira Server Components. Use `"use client"` somente para estado e eventos de interface.
- Use as APIs oficiais atuais do Next.js e Supabase. Mantenha `package-lock.json` atualizado pelo npm e use `npm ci` para reproduzir instalações.
- Preserve o Git existente; use o checkout da tarefa. Não crie worktrees a menos que o usuário peça.

## Segurança

- Cadastro real permanece exclusivo por convite. `/cadastro` cria apenas perfil local de demonstração, com convite de teste AMIGOS20. Não transforme isso em controle de acesso real.
- Não registre senhas, tokens ou dados de formulário. Não grave segredos no repositório.
- Somente URL e chave publicável do Supabase podem usar `NEXT_PUBLIC_`. Chaves administrativas/secretas nunca podem estar no cliente.
- Não ative as fábricas Supabase sem nova solicitação de integração. Na integração futura, configure renovação de sessão no servidor conforme documentação oficial, autorização e RLS antes de dados reais.
- As rotas atuais são demonstrações públicas, não áreas protegidas. Perfil, tema e preferências ficam no armazenamento local, sem e-mail ou senha; mensagens, grupos e anexos são temporários na memória da aba. Respostas automáticas devem ser identificadas como simulação. Não prometa segurança, privacidade operacional ou criptografia ponta a ponta ainda não implementadas.

## Interface e validação

- Layout responsivo, HTML semântico, rótulos nos campos, foco visível, navegação por teclado e alvos de toque adequados.
- No desktop, mantenha usuários/grupos fixos à esquerda e a conversa preenchendo todo o espaço restante até a borda direita, sem limitar a largura da área principal. No celular, alterne entre lista e conversa. Engrenagem e clipe devem estar visíveis; o campo de mensagem tem largura moderada. Configurações devem ter efeito real ou informar a limitação.
- Gravação começa no clique do microfone e a seta envia diretamente; ouvir antes é opcional, sem confirmação de anexo obrigatória. Use MediaRecorder mediante ação e permissão explícitas. Libere streams ao parar, sair ou cancelar, inclusive se a permissão resolver depois do fechamento. HTTP na rede local não oferece gravação; mantenha a opção de anexar áudio.
- Notificações de sistema só pedem permissão por botão, exigem contexto seguro e não são push com o app fechado. Download automático controla prévias, nunca salvamento em disco sem ação. Não prometa suporte móvel universal.
- Perfis, visibilidade do código, leituras e digitação são demonstrações; filtre os participantes da conversa, respeite as opções locais e identifique as simulações. Nunca apresente filtros do frontend como autorização real.
- Convites reais deverão exigir e-mail vinculado e verificação independente na aceitação, além de uso único atômico, validade e revogação. Um link de uso único sozinho pode ser repassado antes de usado. Consulte docs/convites-e-privacidade.md; não implemente Auth/RLS sem uma nova etapa de integração.
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
