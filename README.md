# M&N CHAT

Protótipo de um aplicativo privado de mensagens para até 20 amigos e familiares, com acesso futuro exclusivamente por convite do administrador.

## Etapa 1

- Login visual com campos de e-mail e senha e botão para mostrar/ocultar senha.
- Demonstração com cinco conversas fictícias, busca por nome, filtros e prévia de contato/grupo.
- Layout responsivo em português do Brasil, navegação por teclado e foco visível.
- **Sem autenticação real, cadastro público, convites, mensagens reais, persistência ou PWA.** As rotas são públicas e contêm somente dados fictícios. O limite de 20 pessoas e o controle de convidados ainda não são aplicados.
- O formulário não envia nem armazena dados; não use credenciais reais na demonstração.

## Executar localmente

Requisitos: Node.js **24 LTS** (`.nvmrc`) e npm 11. O projeto foi validado com Node 24.19.0 e npm 11.9.0.

```bash
# A partir do checkout do repositório
nvm use # opcional, se usar nvm
npm ci
npm run dev
```

Abra `http://localhost:3000` no seu ambiente local. A raiz redireciona para `/login`; o link “Explorar demonstração” abre `/conversas` sem autenticação. Não é necessário configurar Supabase para executar esta etapa.

A configuração `.npmrc` usa cache temporário em `/tmp/mn-chat-npm-cache`, compatível com o ambiente de nuvem. Em outro sistema, sobrescreva com `npm --cache <pasta> ci` se necessário.

## Verificações

```bash
npm run lint
npm run typecheck
npm run build
npm start
```

`typecheck` gera os tipos das rotas com `next typegen` e executa TypeScript sem emitir arquivos. `build` gera a versão de produção; `start` a inicia. A porta pode ser alterada com `npm run dev -- --port 3001` ou `npm start -- --port 3001`.

Para conferir a interface: abra as duas rotas em desktop e celular, alterne a visibilidade da senha, submeta o formulário com dados fictícios, navegue para a demonstração, busque um nome, filtre “Não lidas”, teste uma busca sem resultados e abra/feche a prévia. Não existe envio de mensagens.

## Estrutura

```text
app/                  Layout, estilos e rotas /login e /conversas
components/           Marca, formulário visual e lista interativa
lib/data/             Conversas fictícias tipadas
lib/supabase/         Fábricas oficiais de cliente e servidor, ainda não utilizadas
types/               Tipos de domínio
```

## Preparação para Supabase — próxima etapa

O projeto deriva do exemplo oficial [`with-supabase`](https://github.com/vercel/next.js/tree/canary/examples/with-supabase), obtido do commit `b0e1bf792f18c039933d8a9ce9d50d35f930f1be`. Foram mantidas as fábricas de cliente/servidor e a base Next.js/TypeScript/Tailwind, com dependências estáveis fixadas no lockfile e ESLint alinhado à versão do Next.js. Fluxos de cadastro, autenticação e renovação de sessão do exemplo foram omitidos para respeitar o escopo desta etapa.

Quando a integração for solicitada, copie o exemplo de variáveis:

```bash
cp .env.example .env.local
```

Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com os valores do projeto. Nunca coloque `service_role`, secret keys ou outras credenciais administrativas em variáveis `NEXT_PUBLIC_`. `.env.local` e demais arquivos de ambiente estão ignorados; somente `.env.example` pode ser versionado.

As fábricas em `lib/supabase/` não são chamadas por nenhuma página e não realizam requisições nesta etapa. Antes de usá-las, a próxima etapa deverá configurar sessão no servidor, desabilitar cadastro público no Supabase, definir autorização por convite e políticas RLS. Não há necessidade de chave administrativa agora.

Referências oficiais: [Next.js App Router](https://nextjs.org/docs/app), [Supabase com Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs) e [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

O PWA será uma etapa futura; não há service worker ou instalação offline neste protótipo.
