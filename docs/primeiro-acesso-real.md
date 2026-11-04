# Login real e primeira conta administrativa

Para novos amigos, use agora [Convites pelo aplicativo](convites-pelo-aplicativo.md): configuração única e ativação automática após OTP. O provisionamento manual abaixo documenta a entrega inicial e não é necessário para cada convite.

Esta entrega adiciona `/entrar`, `/primeiro-acesso` e `/conta`. As rotas antigas `/login`, `/cadastro`, `/perfil` e `/conversas` continuam como demonstração local, sem mensagens reais. Há um link “Entrar na conta real” na tela antiga. O cadastro público deve continuar desligado.

## 1. Aplicar a correção do contador

No projeto MenChat, SQL Editor → New query, copie [este SQL](https://raw.githubusercontent.com/JonathaPereira/MeN-CHAT/main/supabase/migrations/20261104000200_profile_accounting.sql) e clique em Run, uma vez. Depois execute [verify.sql](https://raw.githubusercontent.com/JonathaPereira/MeN-CHAT/main/supabase/verify.sql). O resultado esperado é `BASE_OK`, versão `20261104000200_profile_accounting` e 0 contas ativas se ainda não criou perfis.

A primeira migração contava a tentativa de INSERT antes de saber se um conflito a transformaria em UPDATE. A correção move a contagem para AFTER e recalcula o contador a partir das contas reais, sem apagar perfis ou mudar códigos. A migração original aplicada não foi reescrita.

## 2. Preparar sua identidade no painel Auth

1. Supabase → Authentication → Users → Add user → **Create new user**, não Invite user.
2. Use seu próprio e-mail. Para testar com o envio padrão do Supabase, prefira o mesmo e-mail de sua conta de acesso ao painel; o serviço de e-mail padrão restringe destinatários aos membros autorizados da organização.
3. Defina uma senha temporária forte, guardada localmente. Não envie a senha pelo chat.
4. Ative **Auto Confirm User** somente para essa identidade que você, proprietário do projeto, está provisionando administrativamente. Não ligue cadastro público nem desligue a confirmação global de e-mail.
5. Crie a identidade. Ela ainda não tem perfil ativo no MenChat nem é administradora.

Auto Confirm é uma declaração administrativa no Auth, não prova de acesso à caixa de e-mail. O fluxo abaixo exige um novo código entregue ao e-mail antes de definir a senha que você usará. Isso é necessário porque, com cadastro público desligado, o fluxo OTP do Supabase exige que essa identidade existente já esteja confirmada. Não provisionamos usuários a partir do navegador.

## 3. Configurar o e-mail com código

Authentication → Email Templates (ou Emails → Templates) → **Magic Link**. Mantenha o assunto ou use “Seu código do MenChat”. No corpo, coloque:

```html
<h2>Seu código do MenChat</h2>
<p>{{ .Token }}</p>
<p>Digite este código no aplicativo. Não compartilhe com outras pessoas.</p>
```

Salve. O placeholder é literalmente `{{ .Token }}`; não substitua por um número. Não use o link `ConfirmationURL` como substituto do código nesta tela. O template é uma configuração global do projeto, que neste caso é dedicado ao MenChat.

O serviço padrão é limitado e pode impedir envios por frequência ou por destinatário. Não é adequado para liberar os amigos. Se o código não chegar, confira spam, os logs de Authentication e as restrições de envio. Não compartilhe o código ou os logs completos. Aguarde antes de solicitar novamente. SMTP de um provedor transacional será configurado antes dos convites reais. O aplicativo usa resposta uniforme para não expor se um e-mail está cadastrado.

## 4. Atualizar e iniciar o aplicativo no Windows

Baixe o [ZIP atualizado](https://github.com/JonathaPereira/MeN-CHAT/archive/refs/heads/main.zip), extraia e abra o Git Bash na pasta com `package.json`. Copie **localmente** o `.env.local` da sua pasta anterior para essa nova pasta (não para o GitHub). Ele deve conter apenas sua URL e chave publicável, como no teste de conexão; nenhuma chave administrativa é necessária nesta entrega.

Com o servidor anterior parado (Ctrl+C):

```bash
npm ci --cache "$LOCALAPPDATA/npm-cache"
npm run supabase:check
npm run build
npm start -- --hostname 0.0.0.0 --port 3001
```

No computador, abra **http://127.0.0.1:3001/primeiro-acesso**. Teste credenciais reais em localhost; para usar contas reais no celular, a publicação HTTPS será outra entrega. O endereço de IP doméstico em HTTP continua servindo ao teste visual, sem a confidencialidade de uma conexão HTTPS.

## 5. Verificar seu e-mail e definir senha

1. Informe o e-mail provisionado no painel e clique **Enviar código por e-mail**.
2. Abra a caixa de entrada desse e-mail e copie o código mais recente. Ele expira e é de uso único no Auth; códigos inválidos/expirados não definem senha.
3. Na mesma página, preencha Código recebido, Nova senha e Confirmar nova senha. Use pelo menos 12 caracteres. O limite de 72 bytes é validado no servidor por compatibilidade com o serviço de senha; caracteres UTF-8 podem usar mais de um byte.
4. Clique **Verificar código e definir senha**.
5. O esperado, antes da ativação, é **Sua conta ainda não tem acesso ativo** com seu e-mail. Isso significa que existe uma sessão de autenticação; ainda não concede acesso aos perfis privados.

Para redefinir senha futuramente, o mesmo fluxo exige outro código entregue ao seu e-mail. Nunca usamos somente o e-mail informado no formulário para autorizar uma alteração de senha. Um usuário pendente não consegue se ativar por essa tela.

## 6. Definir você como o primeiro administrador

Somente depois de concluir a verificação acima, abra [setup-owner.sql](https://raw.githubusercontent.com/JonathaPereira/MeN-CHAT/main/supabase/setup-owner.sql). Copie para **uma nova consulta do SQL Editor**.

Na linha:

```sql
owner_email text := lower(btrim('SEU_EMAIL_AQUI'));
```

Substitua `SEU_EMAIL_AQUI` pelo mesmo e-mail que acabou de verificar. Não coloque senha, código de e-mail, chave ou UUID. Execute com Run. O esperado é `ADMIN_OK` e `administradores_ativos = 1`.

Esse script é uma operação administrativa manual. Ele exige o estado de confirmação do Auth, mas esse campo também pode ser marcado pelo administrador com Auto Confirm; por isso, o operador deve concluir o código independente na etapa anterior antes de ativar. A tela pública não tem endpoint para executar esse script, promover usuários ou escolher o primeiro dono. Só quem já administra o projeto no painel pode fazer a ativação. O script não promove uma segunda pessoa se já há outro administrador; repetir para a mesma pessoa não consome outra vaga nem muda o código.

Não salve no repositório uma cópia editada com seus dados pessoais. Não use esse roteiro como fluxo de convite para amigos.

## 7. Testar o login

Volte ao app e clique **Verificar liberação** ou abra **http://127.0.0.1:3001/conta**. Deverá mostrar “Sua conta está conectada”, nome, e-mail, código e papel Administrador.

Clique **Sair deste aparelho**. Em **http://127.0.0.1:3001/entrar**, entre com seu e-mail e a nova senha. Abra `/conta` em uma janela anônima: deverá voltar ao login, sem revelar o perfil. Senha incorreta deve falhar. Conta sem perfil ativo continua bloqueada, mesmo autenticada.

Mensagens e convites pelo aplicativo ainda não estão conectados. A página `/conta` exibe somente seu perfil real; o link de demonstração abre dados fictícios. Não há envio de convites reais nem criação pública de contas.

## Segurança e testes desta entrega

- Server Actions para login/OTP/senha/saída, validação de entrada e proteção de origem do Next. Sem senha/código em query strings, logs ou armazenamento local da aplicação.
- `proxy.ts` renova cookies SSR com `getClaims()`, preservando cookies e headers de cache do SDK. Rotas reais recebem `private, no-store`. Cada requisição cria seu próprio cliente Supabase.
- `/conta` revalida a identidade com `getUser()` no servidor e exige perfil próprio ativo por RLS; não autoriza a partir de `getSession()`/cookies sem verificação. Pendentes e desativados não recebem o perfil.
- O login depende do Auth e da tabela de perfis. Erros não dão acesso de demonstração como substituto de uma conta real.
- `npm test` usa serviços simulados para verificar o fluxo; `npm run test:db` aplica migrações em PostgreSQL isolado e testa a ativação administrativa, RLS, repetição, reparo de contagem e concorrência. `npm run test:e2e` cobre interface e bloqueio sem sessão. `npm run test:dev` cobre também o acesso em desenvolvimento. Não enviam e-mails reais nem validam seu provedor SMTP.
- O teste de ponta a ponta com Supabase hospedado e entrega de e-mail deve ser feito nos passos acima. Não recebemos suas credenciais nesta conversa, e não afirmamos que seu login já foi validado aqui.

Fontes: [SSR oficial com Next](https://supabase.com/docs/guides/auth/server-side/nextjs), [OTP por e-mail](https://supabase.com/docs/guides/auth/auth-email-passwordless), [template oficial Next/Supabase](https://github.com/vercel/next.js/blob/canary/examples/with-supabase/lib/supabase/proxy.ts).
