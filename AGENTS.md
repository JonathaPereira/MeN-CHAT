# Diretrizes do M&N CHAT

## Produto e escopo
- Aplicativo privado para até 20 amigos e familiares, exclusivamente por convite do administrador.
- Trabalhe em etapas pequenas e verificáveis. Implemente apenas a etapa solicitada e pare ao concluí-la.
- Etapa atual: 1, protótipo visual. Não há autenticação real, convites, mensagens, banco de dados ou PWA.
- Interface e textos em português do Brasil; nome provisório M&N CHAT.

## Stack e organização
- Node.js 24 LTS, npm, Next.js estável com App Router, React, TypeScript estrito e Tailwind CSS.
- `app/`: rotas, metadados e layout; `components/`: componentes; `lib/data/`: dados fictícios; `types/`: tipos de domínio; `lib/supabase/`: fábricas oficiais ainda inativas.
- Prefira Server Components. Use `"use client"` somente para estado e eventos de interface.
- Use as APIs oficiais atuais do Next.js e Supabase. Mantenha `package-lock.json` atualizado pelo npm e use `npm ci` para reproduzir instalações.
- Preserve o Git existente; use o checkout da tarefa. Não crie worktrees a menos que o usuário peça.

## Segurança
- Nunca implemente cadastro público. Não reintroduza as rotas de sign-up do template.
- Não registre senhas, tokens ou dados de formulário. Não grave segredos no repositório.
- Somente URL e chave publicável do Supabase podem usar `NEXT_PUBLIC_`. Chaves administrativas/secretas nunca podem estar no cliente.
- Não ative as fábricas Supabase nesta etapa. Na integração futura, configure renovação de sessão no servidor conforme documentação oficial, autorização e RLS antes de dados reais.
- As rotas atuais são demonstrações públicas, não áreas protegidas. Não prometa segurança, privacidade operacional ou criptografia ponta a ponta ainda não implementadas.

## Interface e validação
- Layout responsivo, HTML semântico, rótulos nos campos, foco visível, navegação por teclado e alvos de toque adequados.
- Identifique dados fictícios e funcionalidades indisponíveis; evite controles que pareçam executar ações reais.
- Antes de concluir: `npm run lint`, `npm run typecheck`, `npm run build` e smoke test das páginas e interações em desktop e celular quando houver navegador disponível.
- Informe arquivos alterados, verificações, limitações e o que ficou fora da etapa. Não avance automaticamente.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
