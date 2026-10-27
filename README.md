# MenChat

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

## Se ficar carregando ou os botões não responderem

Veja o [passo a passo de correção no Windows](docs/solucao-carregamento-windows.md). Para testar a interface sem recompilar durante o uso, prefira `npm run build` e depois `npm start -- --hostname 0.0.0.0 --port 3001`. Use a mesma porta nos dois aparelhos.

A configuração de desenvolvimento autoriza automaticamente os IPv4 da máquina e fixa a raiz do Turbopack na pasta do projeto. Não é necessário editar um IP pessoal no código. Reinicie o servidor se mudar de rede.

## O que testar

1. **Tema e login:** a tela contém somente a marca MenChat, o formulário e as ações de acesso de demonstração. A entrada tem animação discreta e respeita redução de movimento. Use sol/lua desde o login ou no menu do chat. A preferência é salva no navegador; sem preferência, segue o sistema.
2. **Login e cadastro:** ambos são demonstrações, não autenticação. Para cadastrar um perfil fictício, preencha nome, e-mail, senha com pelo menos oito caracteres, confirmação e convite **AMIGOS20**. Não use sua senha real. E-mail e senha não são enviados nem armazenados.
3. **Perfil:** edite nome e status, selecione/remova uma foto e salve. O perfil fica somente no navegador atual. A foto é reduzida localmente para até 256 × 256 pixels; aceita JPG/PNG/WebP de até 2 MB.
4. **Chat automatizado:** `/conversas` abre diretamente o **Assistente M&N**. No desktop, usuários e grupos ficam fixos à esquerda; a conversa ocupa toda a área restante até a borda direita, sem faixas vazias externas. No celular, a seta alterna entre conversa e lista. Envie uma mensagem e aguarde cerca de um segundo. A engrenagem abre as configurações; os três pontos mantêm as ações adicionais. É uma resposta programada local, sem IA externa. Os demais contatos são fictícios e também recebem respostas identificadas do assistente para testar a interface.
5. **Código:** cada novo perfil de demonstração recebe um código de seis letras/números. No menu do chat ou da lista, escolha “Nova conversa por código” e teste **A1B2C3** para Ana ou **BOT202** para o assistente. O código público não é senha nem convite. Não existe diretório de usuários reais ou garantia de unicidade entre navegadores.
6. **Grupos:** no menu ou na lista de conversas, clique em “Criar grupo”, informe um nome e selecione ao menos um participante fictício. Você é incluído automaticamente. O assistente também responde nos grupos de teste.
7. **Anexos:** use o clipe, selecione arquivos, remova se desejar e envie a prévia local. Fotos até 5 MB, vídeos até 25 MB, áudios/documentos até 10 MB; no máximo cinco anexos por mensagem. Arquivos não vão para nenhuma nuvem.
8. **Mensagem de voz:** clique no microfone para começar (na primeira vez, permita o acesso ao microfone). Clique na seta “Enviar áudio” para parar e enviar diretamente, sem passos intermediários de anexo. Você também pode descartar pela lixeira ou, opcionalmente, parar para ouvir antes de enviar. Grave até 2 minutos; ao atingir o limite, a gravação para e fica disponível para ouvir/enviar. O microfone é liberado ao parar, fechar ou trocar de conversa. Pelo celular em HTTP no Wi-Fi, a gravação não está disponível: use “Escolher áudio do aparelho”. Gravação pelo microfone exige HTTPS ou localhost, além de suporte a MediaRecorder e permissão.
9. **Configurações:** clique na engrenagem visível no cabeçalho do chat ou da lista. Os submenus são Privacidade, Notificações, Dados e armazenamento, Conversas e voz e Aparência. As preferências são locais ao navegador e valem para a mesma interface web em computador e celular.
10. **Responsividade:** experimente janela estreita, tema escuro, mensagens longas, Shift+Enter para quebra de linha, grupos e anexos. No desktop, a lista permanece visível; no celular, use a seta do cabeçalho para voltar à lista. Escape ou o botão de fechar recolhe os menus adicionais. O botão de anexar usa somente o clipe, com rótulo acessível. O campo de mensagem foi ampliado, mantendo os controles visíveis.

Conversas, grupos, mensagens e anexos existem somente na memória desta aba e desaparecem ao recarregar. Preferências, nome, status, foto e código do perfil persistem no armazenamento local desse navegador. Para apagar esse perfil de teste, limpe os dados do site nas configurações do navegador. Tema, perfil e preferências são compartilhados entre abas deste navegador; não há sincronização de mensagens.

## Administração de grupos — demonstração

Clique no nome do grupo para ver os participantes e os papéis de criador, dono, administrador e membro.

- Quem cria um grupo torna-se seu dono e administrador. A identidade do criador original nunca muda, mesmo ao transferir a propriedade.
- Administradores adicionam perfis existentes pelo código de usuário e promovem membros a administrador. Isso não cria contas e não envia convites de cadastro: só adiciona o contato fictício nesta aba.
- O dono pode revogar administradores e remover outros administradores. Administradores comuns removem apenas membros comuns.
- O criador original nunca pode ser removido ou rebaixado por outra pessoa, inclusive pelo novo dono após transferência. O dono atual também é protegido contra remoção pelos demais administradores.
- Sair é uma ação voluntária com confirmação. O dono precisa transferir a propriedade antes de sair se houver outros participantes; se estiver sozinho, pode sair e encerrar o grupo.
- Após sair, o histórico local fica somente para consulta. O campo de envio e o gerenciamento são removidos, e respostas automáticas pendentes daquele grupo são canceladas.
- O grupo aceita até 20 participantes, contando você. Pessoas duplicadas e códigos indisponíveis são rejeitados.

Para testar: em **Família reunida**, Ana é a criadora/dona e você é administrador; adicione Pedro pelo código **P3D4R5**. Em **Os de sempre**, você é membro comum e só pode sair. Crie um grupo novo para experimentar os controles do dono e a transferência de propriedade.

Todas as ações são locais e desaparecem ao recarregar. Antes de usuários reais, essas mesmas regras precisam ser impostas por autorização, transações e RLS no servidor. Veja [as invariantes dos grupos](docs/convites-e-privacidade.md#administração-de-grupos).

## Perfis, leituras e digitação — demonstração

Clique no nome do contato no cabeçalho para abrir o perfil e ver seu código, quando permitido. No nome do grupo, abra os participantes e visite seus perfis. O botão “Enviar mensagem” abre a conversa privada correspondente.

Em Meu perfil, “Ver como contatos veem meu perfil” mostra a prévia, respeitando a visibilidade do código. Em Configurações → Privacidade, você pode ocultar o código, impedir busca pelo próprio código e desativar confirmações de leitura ou indicadores de digitação. As opções persistem neste navegador.

Nas mensagens enviadas, clique na confirmação para abrir “Quem viu”. Em grupos, apenas membros aparecem; contatos que não compartilham confirmação ficam com status indisponível. Nome e avatar identificam quem está digitando. As leituras e a digitação são simuladas, sem outras pessoas conectadas. Textos privados não aparecem nos grupos e vice-versa na memória da demonstração.

Para testar privacidade alheia: Ana mostra o código; Lucas oculta o código no perfil e não compartilha leitura; Júlia desabilitou a busca por código. Códigos fixos e essas preferências pertencem a contatos inteiramente fictícios.

O fluxo de convite real está documentado em [Convites e privacidade](docs/convites-e-privacidade.md): uso único, validade, vínculo ao e-mail e uma verificação independente enviada ao e-mail ao aceitar. O link sozinho não deverá conceder acesso. AMIGOS20 permanece apenas um código de demonstração; essa segurança real ainda depende de Supabase Auth, banco de dados e RLS.

## Como as configurações se comportam

- **Notificações:** por padrão, avisos aparecem somente fora da conversa ativa ou com a aba oculta. É possível silenciar cada conversa pelo menu, ativar/desativar avisos, sons e prévia do texto. A prévia vem desativada por padrão.
- **Sistema e permissões:** a permissão de notificações só é solicitada no botão “Permitir avisos do navegador”. Elas exigem HTTPS/localhost e dependem do suporte do navegador. O botão “Testar notificação” permite conferir o comportamento. Em navegadores que não aceitam a API nesta aba, o aplicativo avisa e usa o alerta interno.
- **Limitações:** não há notificações push com a aba/app fechado, nem service worker. iOS e outros navegadores móveis podem exigir instalação como PWA para avisos do sistema; essa etapa ainda não foi implementada. Sons dependem de interação prévia com a página, das políticas de reprodução e do modo silencioso do aparelho.
- **Download automático:** controla o carregamento das prévias de fotos, vídeos e áudios. Desativado, aparece um botão para carregar cada mídia. “Economia de dados” desativa todas as prévias automáticas. Não há salvamento automático na pasta Downloads; o link para baixar continua manual e ouvir um áudio não dispara download em disco. Nesta demonstração os arquivos são `blob:` locais, sem upload ou tráfego de mídia remota.
- **Texto e voz:** um clique no microfone começa a gravação e um clique na seta envia o áudio. Ouvir antes é opcional. Enter para enviar pode ser desligado; o botão de enviar continua disponível. Velocidade de reprodução: 1×, 1,25×, 1,5× e 2×. A redução de ruído é solicitada ao aparelho ao iniciar a gravação e depende de suporte.
- **Aparência:** tema claro, escuro ou do sistema e texto pequeno, padrão ou grande no chat.

## Verificações automatizadas

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:dev
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

`npm run test:dev` cobre especificamente JavaScript, HMR e interações no servidor de desenvolvimento, na porta 3102; pare outros servidores dev deste checkout antes de executá-lo.

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

### Emojis e figurinhas — demonstração

- Toque na carinha ao lado do clipe: selecione uma categoria ou busque um emoji em português. Ele entra no cursor da mensagem.
- Na aba **Figurinhas**, use **Criar figurinha** para escolher uma imagem, girar, recortar ao centro e adicionar texto. Salve e toque na figurinha para enviar imediatamente, sem apagar o rascunho.
- **Importar** aceita múltiplos arquivos PNG, JPG e WebP de até 5 MB/20 megapixels cada. Imagens são convertidas localmente em WebP estático de 512 × 512 pixels e até 100 KB, com margem e preservação da transparência existente. Não remove fundos automaticamente. Animações são achatadas; GIFs, pacotes `.wastickers` e links do WhatsApp não são importados. Isso não integra nem exporta pacotes para o WhatsApp.
- Coleção de até 40 figurinhas salva no IndexedDB deste navegador/origem. Não sincroniza entre dispositivos ou endereços (por exemplo, localhost e IP). Excluir da coleção não apaga as mensagens já enviadas. Limpar dados do site remove a coleção; navegação privada pode descartá-la. Se o armazenamento falhar, um erro aparece.
- As mensagens continuam temporárias na aba, sem upload. Prévias de figurinhas respeitam as opções de imagens/download automático e economia de dados.

## Recorte, bola de neve e próximos passos

No editor de figurinhas, arraste a imagem com o dedo/mouse ou use zoom e posições horizontal/vertical. Há recorte quadrado/circular, enquadramento inteiro/preencher, rotação e redefinição. Os ajustes aparecem na prévia e no arquivo salvo, com transparência fora do círculo quando usado.

Na carinha ao lado do clipe, **Jogar bola de neve** envia um evento no privado ou no grupo, sem apagar o rascunho. Cada pessoa tem uma única bola por conversa. Na demonstração, existe apenas o usuário local, o limite vale na memória da aba e reinicia ao recarregar; não é uma proteção de servidor. O envio mostra neste aparelho uma prévia de recebimento com aviso e tentativa de vibração dupla, quando suportada. Não envia a outro aparelho e não dispara de novo ao apenas abrir o histórico. Configurações → Notificações permite desligar aviso, animação e vibração. O controle geral e silenciamento são respeitados; bola de neve pode avisar mesmo na conversa ativa. Não há push com o app fechado. iPhone/Safari não suporta a API de vibração; Android e outros navegadores podem bloquear o pedido.

Na administração de grupos, **Remover** agora leva a confirmação para a área visível e coloca o foco nela. Confirme para concluir. Você só remove participantes conforme seu papel: em Família reunida você é admin, pode remover Lucas/Júlia e não pode remover Ana, criadora. Em Os de sempre você é membro comum. Crie um novo grupo para testar remoção como dono. O criador segue protegido.

Veja o [passo a passo de Supabase, publicação HTTPS e instalação no celular](docs/integracao-e-celular.md). Primeiro, crie um projeto **de teste** no Supabase, mantenha cadastro público desativado e configure URL/chave publicável apenas no seu `.env.local`. Isso prepara a próxima entrega; ainda não ativa a integração real nesta versão.
