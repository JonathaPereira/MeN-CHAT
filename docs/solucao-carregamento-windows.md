# Carregamento infinito ou tela sem interação no Windows/celular

## O que foi encontrado

O log fornecido mostrou:

- `Blocked cross-origin request ... /_next/hmr`: o servidor de desenvolvimento não autorizava o IP local do Windows.
- `ignored package-lock.json ... outside the current Git repository`: havia uma pasta clonada dentro de uma pasta extraída de ZIP e o Turbopack detectou uma raiz inadequada.
- A porta 3000 estava ocupada; o Next iniciou na 3001. A mudança de porta não é um erro da aplicação, mas todos os aparelhos precisam usar a porta efetivamente exibida.

Esses sinais justificam corrigir a configuração e reiniciar o servidor com o cache gerado limpo. Eles não permitem atribuir toda falha de JavaScript a uma única causa sem observar o navegador do usuário.

## Correção salva no projeto

`next.config.ts` fixa `turbopack.root` na pasta da própria configuração, inclusive quando o caminho tem espaços. `allowedDevOrigins` inclui o loopback IPv4 e os IPv4 efetivamente atribuídos ao computador que está executando o servidor. Não usa coringa global e não publica um IP pessoal fixo no repositório. Origens externas continuam bloqueadas. Se mudar de rede/IP, reinicie o servidor.

A configuração vale para desenvolvimento. Na versão compilada, os recursos de HMR não são usados.

## Atualizar e testar pelo Git Bash

1. No terminal em que o aplicativo está rodando, pressione Ctrl+C e aguarde o prompt `$` voltar.
2. Execute uma linha por vez, a partir da pasta clonada. Se algum comando falhar, pare e examine o erro antes de continuar:

   ```bash
   cd "$(git rev-parse --show-toplevel)"
   git pull --ff-only origin main
   rm -rf .next
   npm ci --cache "$LOCALAPPDATA/npm-cache"
   npm run build
   npm start -- --hostname 0.0.0.0 --port 3001
   ```

   `.next` contém apenas arquivos gerados pelo Next.js. Não apague `.git`, `.env.local`, o código ou os dados do navegador. Não é necessário encerrar o processo desconhecido que está usando a porta 3000.

3. No computador, abra `http://localhost:3001/login`. Use Ctrl+Shift+R para atualizar a página sem reutilizar o cache.
4. No celular, na mesma rede Wi-Fi, abra `http://IPV4-DO-WINDOWS:3001/login`, substituindo o hostname pelo IPv4 mostrado por `ipconfig`. Feche a aba antiga e abra novamente se necessário. O computador e o terminal precisam permanecer ligados.
5. Teste a engrenagem e envie uma mensagem ao Assistente M&N. Apenas visualizar o HTML não confirma que o JavaScript carregou.

Se a porta 3001 estiver ocupada, escolha outra porta livre explicitamente e use a mesma nos dois aparelhos. Se `git pull` informar alterações locais, preserve seu trabalho e resolva o conflito; não use reset ou force para contornar.

Para voltar ao modo de edição com atualização automática:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3001
```

Pare o modo compilado com Ctrl+C antes de iniciar outro servidor na mesma porta. Quando baixar uma atualização do código, gere um novo build antes de usar `npm start` novamente.

## Verificações disponíveis

- `npm test`: confere a raiz explícita e as origens locais, além das regras do chat.
- `npm run test:dev`: inicia o servidor dev na porta 3102, verifica JavaScript, HMR e interações em `localhost` e `127.0.0.1`, e testa que origens desta máquina são aceitas e origens externas recebem 403.
- `npm run test:e2e`: faz o build e testa a interface no servidor compilado.

Para os testes de navegador, instale Chromium com `npx playwright install chromium`. Pare servidores de desenvolvimento deste mesmo checkout antes de `test:dev`, pois eles compartilham `.next/dev`. Na nuvem, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:dev -- --workers=2`.

Os testes automatizados não substituem a confirmação no Windows e no celular reais do usuário. Se o problema persistir, confira as mensagens do terminal e do Console/Rede do navegador, especialmente erros em arquivos `/_next/`.
