# Primeira conexão com Supabase no Windows

Esta entrega verifica URL, chave publicável, acesso ao Auth e bloqueio de cadastro público. Não cria tabelas, não aplica migrações e não ativa login real. As conversas continuam sendo demonstração. Após a conexão, aplique a base do banco e siga docs/primeiro-acesso-real.md para configurar a conta administrativa nas rotas reais.

1. Baixe a versão atualizada do GitHub em Code → Download ZIP e extraia. Abra o Git Bash na pasta que contém `package.json`.
2. No projeto MenChat do Supabase, clique em **Connect** e procure a **Project URL**. Também pode aparecer em Settings → Data API. Copie o endereço HTTPS do projeto, não o endereço do dashboard.
3. Em Settings → API Keys, copie a **publishable key**, que começa com `sb_publishable_`. Não use `sb_secret_`, `service_role`, connection string ou senha do banco. Os nomes dos menus podem variar.
4. No Git Bash, execute:

```bash
cp -n .env.example .env.local
notepad.exe .env.local
```

5. No arquivo, preencha os valores reais depois de `=`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

Não publique esse arquivo. Ele é ignorado pelo Git. Não é necessário enviar nenhuma chave pelo chat. O arquivo criado no Windows não configura automaticamente o ambiente remoto desta conversa.

6. Salve e feche o Bloco de Notas. Execute:

```bash
npm ci --cache "$LOCALAPPDATA/npm-cache"
npm run supabase:check
```

Resultado esperado: `Conexão com Supabase OK. Cadastro público bloqueado.` O teste usa somente leitura de `/auth/v1/settings`, não cria contas nem altera configurações. Isso não testa PostgreSQL, RLS, convites ou envio de e-mail.

Se indicar cadastro aberto, volte a Authentication e desligue Allow new users to sign up. Se houver recusa, confira URL/chave do mesmo projeto; se houver falha de rede, confira se o projeto está ativo e se a rede permite o host do Supabase. Nunca copie mensagens contendo senhas ou chaves; o comando imprime apenas erros resumidos.

7. Informe o resultado do comando. Depois, siga docs/banco-inicial.md e docs/primeiro-acesso-real.md. O teste de conexão sozinho não cria nem ativa uma conta.
