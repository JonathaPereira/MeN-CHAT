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

## Abrir no celular pelo mesmo Wi-Fi

1. Conecte o Windows e o celular à mesma rede Wi-Fi de confiança.
2. No terminal do projeto, pare o servidor com Ctrl+C e inicie:

   ```bat
   npm.cmd run dev -- --hostname 0.0.0.0
   ```

3. Abra outra janela do Prompt de Comando no Windows e execute `ipconfig`. Procure o **Endereço IPv4** do adaptador Wi-Fi conectado.
4. No navegador do celular, abra `http://SEU-IPV4:3000`. Exemplo: se o IPv4 for `192.168.1.10`, abra `http://192.168.1.10:3000`.
5. Se o Firewall do Windows perguntar, permita Node.js em **redes privadas**. Mantenha o computador ligado e o terminal aberto. Redes de convidados podem impedir a comunicação entre aparelhos.

O endereço `localhost` no celular aponta para o próprio celular; use o IPv4 do Windows. O acesso acima serve para testar na rede local. Não configure redirecionamento de portas no roteador. Para acessar fora do Wi-Fi, será necessário hospedar uma versão de demonstração, o que ainda não foi feito.

Perfil e conversas continuam locais a cada navegador; o celular conversa com o assistente de teste, sem sincronização com o computador. O código usa `crypto.getRandomValues` para IDs temporários e não depende de `crypto.randomUUID`, que exige contexto seguro e não está disponível normalmente por HTTP em um endereço da rede local.

## O que testar

1. **Tema:** use sol/lua desde o login ou no menu do chat. A preferência é salva no navegador; sem preferência, segue o sistema.
2. **Login e cadastro:** ambos são demonstrações, não autenticação. Para cadastrar um perfil fictício, preencha nome, e-mail, senha com pelo menos oito caracteres, confirmação e convite **AMIGOS20**. Não use sua senha real. E-mail e senha não são enviados nem armazenados.
3. **Perfil:** edite nome e status, selecione/remova uma foto e salve. O perfil fica somente no navegador atual. A foto é reduzida localmente para até 256 × 256 pixels; aceita JPG/PNG/WebP de até 2 MB.
4. **Chat automatizado:** `/conversas` abre diretamente o **Assistente M&N** em tela inteira. Envie uma mensagem e aguarde cerca de um segundo. O botão de lista no canto superior esquerdo abre as conversas; o botão de três pontos abre os menus. Não há barra lateral fixa nem margens vazias ao redor do chat. É uma resposta programada local, sem IA externa. Os demais contatos são fictícios e também recebem respostas identificadas do assistente para testar a interface.
5. **Código:** cada novo perfil de demonstração recebe um código de seis letras/números. No menu do chat ou da lista, escolha “Nova conversa por código” e teste **A1B2C3** para Ana ou **BOT202** para o assistente. O código público não é senha nem convite. Não existe diretório de usuários reais ou garantia de unicidade entre navegadores.
6. **Grupos:** no menu ou na lista de conversas, clique em “Criar grupo”, informe um nome e selecione ao menos um participante fictício. Você é incluído automaticamente. O assistente também responde nos grupos de teste.
7. **Anexos:** use o clipe, selecione arquivos, remova se desejar e envie a prévia local. Fotos até 5 MB, vídeos até 25 MB, áudios/documentos até 10 MB; no máximo cinco anexos por mensagem. Arquivos não vão para nenhuma nuvem.
8. **Mensagem de voz:** clique no microfone e em “Iniciar gravação”. Após permitir o microfone, grave até 2 minutos, pare, ouça e escolha descartar ou anexar. Só o botão de envio adiciona o áudio à conversa. O microfone é liberado ao parar, fechar ou trocar de conversa. Pelo celular em HTTP no Wi-Fi, a gravação não está disponível: use “Escolher áudio do aparelho”. Gravação pelo microfone exige HTTPS ou localhost, além de suporte a MediaRecorder e permissão.
9. **Configurações:** menu do chat → Configurações. Os submenus são Notificações, Dados e armazenamento, Conversas e voz e Aparência. As preferências são locais ao navegador e valem para a mesma interface web em computador e celular.
10. **Responsividade:** experimente janela estreita, tema escuro, mensagens longas, Shift+Enter para quebra de linha, grupos e anexos. Use o botão de lista no cabeçalho para abrir ou trocar uma conversa; Escape ou o botão de fechar recolhe os menus.

Conversas, grupos, mensagens e anexos existem somente na memória desta aba e desaparecem ao recarregar. Preferências, nome, status, foto e código do perfil persistem no armazenamento local desse navegador. Para apagar esse perfil de teste, limpe os dados do site nas configurações do navegador. Tema, perfil e preferências são compartilhados entre abas deste navegador; não há sincronização de mensagens.

## Como as configurações se comportam

- **Notificações:** por padrão, avisos aparecem somente fora da conversa ativa ou com a aba oculta. É possível silenciar cada conversa pelo menu, ativar/desativar avisos, sons e prévia do texto. A prévia vem desativada por padrão.
- **Sistema e permissões:** a permissão de notificações só é solicitada no botão “Permitir avisos do navegador”. Elas exigem HTTPS/localhost e dependem do suporte do navegador. O botão “Testar notificação” permite conferir o comportamento. Em navegadores que não aceitam a API nesta aba, o aplicativo avisa e usa o alerta interno.
- **Limitações:** não há notificações push com a aba/app fechado, nem service worker. iOS e outros navegadores móveis podem exigir instalação como PWA para avisos do sistema; essa etapa ainda não foi implementada. Sons dependem de interação prévia com a página, das políticas de reprodução e do modo silencioso do aparelho.
- **Download automático:** controla o carregamento das prévias de fotos, vídeos e áudios. Desativado, aparece um botão para carregar cada mídia. “Economia de dados” desativa todas as prévias automáticas. Não há salvamento automático na pasta Downloads; o link para baixar continua manual e ouvir um áudio não dispara download em disco. Nesta demonstração os arquivos são `blob:` locais, sem upload ou tráfego de mídia remota.
- **Texto e voz:** Enter para enviar pode ser desligado; o botão de enviar continua disponível. Velocidade de reprodução: 1×, 1,25×, 1,5× e 2×. A redução de ruído é solicitada ao aparelho ao iniciar a gravação e depende de suporte.
- **Aparência:** tema claro, escuro ou do sistema e texto pequeno, padrão ou grande no chat.

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

`npm test` usa o runner nativo do Node.js 24 para códigos, limites de arquivos, respostas programadas e regras de preferências/notificações. `npm run test:e2e` faz o build e inicia temporariamente o servidor de produção na porta 3100. A suíte Playwright cobre desktop (1440 × 900), celular (390 × 664) e tela pequena (320 × 640), sem testar aparelhos físicos. A gravação usa um microfone sintético fornecido pelo Chromium de teste; não acessa o microfone real de quem executa a suíte. Há verificações de gravação, prévia, liberação do microfone, permissão negada, menus, preferências e notificações de sistema com API simulada. Deixe a porta 3100 livre. Os testes de navegador precisam de acesso local, sem credenciais externas.

Na nuvem, é possível reutilizar o Chromium instalado:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=3
```

Para produção local: `npm run build` seguido de `npm start`. Isso não publica o aplicativo na internet.

## Estrutura

```text
app/                   Rotas /login, /cadastro, /perfil, /conversas e /configuracoes
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

Veja [anexos e limites da Cloudflare](docs/anexos-e-cloudflare.md). A política do aplicativo foi definida para os testes; nenhum serviço Cloudflare foi provisionado. PWA, chamadas, push com o app fechado, autenticação real e comunicação entre pessoas ficam para etapas futuras.
