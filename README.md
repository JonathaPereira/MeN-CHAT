# M&N CHAT

Um espaço para até 20 amigos e familiares, com acesso futuro exclusivamente por convite. Nesta etapa, você pode testar a interface e conversar com um assistente automático local, sem contas reais e sem outras pessoas conectadas.

## Abrir no Windows

Instale **Node.js 24 LTS** e baixe este repositório pelo GitHub em **Code → Download ZIP**. Extraia o ZIP, abra a pasta que contém `package.json` e digite `cmd` na barra de endereço do Explorador de Arquivos.

Execute um comando por vez:

```bat
npm.cmd ci --cache "%LOCALAPPDATA%\npm-cache"
npm.cmd run dev
```

Quando aparecer `Ready`, abra `http://localhost:3000` no seu navegador. Mantenha o terminal aberto; Ctrl+C encerra o servidor. Depois de baixar uma nova versão, pare o servidor, execute novamente `npm.cmd ci` e inicie o projeto.

Em Linux/macOS, com Node.js 24, use `npm ci` e `npm run dev`. `.nvmrc` fixa a versão principal. `.npmrc` configura cache em `/tmp` para a nuvem; o comando Windows acima sobrescreve essa opção.

## O que testar

1. **Tema:** use sol/lua desde o login. A preferência é salva no navegador; sem preferência, segue o sistema.
2. **Login e cadastro:** ambos são demonstrações, não autenticação. Para cadastrar um perfil fictício, preencha nome, e-mail, senha com pelo menos oito caracteres, confirmação e convite **AMIGOS20**. Não use sua senha real. E-mail e senha não são enviados nem armazenados.
3. **Perfil:** edite nome e status, selecione/remova uma foto e salve. O perfil fica somente no navegador atual. A foto é reduzida localmente para até 256 × 256 pixels; aceita JPG/PNG/WebP de até 2 MB.
4. **Chat automatizado:** em `/conversas`, abra **Assistente M&N**, envie uma mensagem e aguarde cerca de um segundo. É uma resposta programada local, sem IA externa. Os demais contatos são fictícios e também recebem respostas identificadas do assistente para testar a interface.
5. **Código:** cada novo perfil de demonstração recebe um código de seis letras/números. Em “Nova conversa por código”, teste **A1B2C3** para Ana ou **BOT202** para o assistente. O código público não é senha nem convite. Não existe diretório de usuários reais ou garantia de unicidade entre navegadores.
6. **Grupos:** clique em “Criar grupo”, informe um nome e selecione ao menos um participante fictício. Você é incluído automaticamente. O assistente também responde nos grupos de teste.
7. **Anexos:** use o clipe, selecione arquivos, remova se desejar e envie a prévia local. Fotos até 5 MB, vídeos até 25 MB, áudios/documentos até 10 MB; no máximo cinco anexos por mensagem. Arquivos não vão para nenhuma nuvem.
8. **Responsividade:** experimente janela estreita, tema escuro, mensagens longas, Shift+Enter para quebra de linha, grupos e anexos. No celular, use a seta do cabeçalho da conversa para voltar à lista.

Conversas, grupos, mensagens e anexos existem somente na memória desta aba e desaparecem ao recarregar. Nome, status, foto e código do perfil persistem no armazenamento local desse navegador. Para apagar esse perfil de teste, limpe os dados do site nas configurações do navegador. Tema e perfil são compartilhados entre abas deste navegador; não há sincronização de mensagens.

## Verificações automatizadas

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Antes do primeiro teste de navegador, instale o Chromium do Playwright:

```bat
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

`npm test` usa o runner nativo do Node.js 24 para códigos, limites de arquivos e respostas programadas. `npm run test:e2e` faz o build e inicia temporariamente o servidor de produção na porta 3100. A suíte Playwright cobre desktop (1440 × 900), celular (390 × 664) e tela pequena (320 × 640), sem testar aparelhos físicos. Deixe a porta 3100 livre. Os testes de navegador precisam de acesso local, sem credenciais externas.

Na nuvem, é possível reutilizar o Chromium instalado:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=3
```

Para produção local: `npm run build` seguido de `npm start`. Isso não publica o aplicativo na internet.

## Estrutura

```text
app/                   Rotas /login, /cadastro, /perfil e /conversas
components/chat/       Lista, diálogos, mensagens, compositor e anexos
components/            Perfil, formulários, tema e estado de demonstração
lib/data/              Perfis e mensagens fictícios
lib/                   Códigos, política de anexos e respostas automáticas
lib/supabase/          Fábricas oficiais ainda inativas
types/                 Tipos compartilhados
tests/                 Testes de regras e fluxos no navegador
docs/                  Pesquisa de limites e preparação do armazenamento
```

## Integração futura

O projeto começou com o template oficial [`with-supabase`](https://github.com/vercel/next.js/tree/canary/examples/with-supabase), commit `b0e1bf792f18c039933d8a9ce9d50d35f930f1be`. Stack: Next.js App Router, React, TypeScript, Tailwind e npm em Node.js 24.

Não é necessário configurar Supabase nesta etapa. As fábricas em `lib/supabase/` não são chamadas. `.env.example` contém apenas os nomes de URL/chave publicável; os demais arquivos `.env*` são ignorados.

O convite AMIGOS20 valida somente o roteiro de demonstração: não protege rotas nem libera conta real. A liberação de usuários exige Supabase Auth com convites administrativos, limite de membros, unicidade de códigos no banco, autorização, RLS e armazenamento privado. Nada disso está ativo nesta versão. Nunca use `service_role`, secret keys ou credenciais administrativas em variáveis `NEXT_PUBLIC_`.

Veja [anexos e limites da Cloudflare](docs/anexos-e-cloudflare.md). A política do aplicativo foi definida para os testes; nenhum serviço Cloudflare foi provisionado. PWA, chamadas, notificações, autenticação real e comunicação entre pessoas ficam para etapas futuras.
