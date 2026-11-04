# Aplicar a base inicial no Supabase

A conexão Auth/HTTP foi validada no Windows. Agora vamos criar apenas a base de perfis e registros internos de convite. O login, criação/aceitação de convites, OTP, SMTP e ativação de usuários ainda serão outra entrega. Não convide amigos para o protótipo ainda.

## No painel, uma vez

1. Abra o projeto de teste MenChat no [painel do Supabase](https://supabase.com/dashboard). Confirme que é o projeto recém-criado, não outro aplicativo.
2. Na lateral, clique em **SQL Editor** (ícone de código). Escolha **New query** ou **+** para abrir uma consulta nova. Use o usuário administrativo padrão do editor; não tente executar como `anon`.
3. Abra [o SQL completo da migração](https://raw.githubusercontent.com/JonathaPereira/MeN-CHAT/main/supabase/migrations/20261104000100_initial_accounts.sql). Na página do texto puro, use **Ctrl+A → Ctrl+C**. Não selecione código de outros sites ou arquivos de teste.
4. Cole no editor do Supabase com **Ctrl+V**. O texto começa com comentários de MenChat e `begin;` e termina com `commit;`.
5. Clique em **Run**. A migração cria `public.menchat_profiles` e o schema interno `menchat_private`. Não apaga tabelas nem cria contas, e não contém segredos ou dados de pessoas.
6. O resultado esperado é **Success. No rows returned** ou indicação equivalente de sucesso. Se houver erro, pare e copie a mensagem; não apague tabelas para tentar novamente. A transação é atômica. Se já foi aplicada, executar novamente dá conflito e não substitui os objetos existentes.
7. Em uma consulta nova, aplique também [a correção incremental de contagem](https://raw.githubusercontent.com/JonathaPereira/MeN-CHAT/main/supabase/migrations/20261104000200_profile_accounting.sql), uma vez. Ela evita contagem dupla ao gravar um perfil existente e ajusta o contador aos perfis reais. Não repita a migração inicial.
8. Abra outra consulta e cole o conteúdo de [verify.sql](https://raw.githubusercontent.com/JonathaPereira/MeN-CHAT/main/supabase/verify.sql). Clique em **Run**. O resultado esperado é uma linha com `resultado = BASE_OK`, a versão `20261104000200_profile_accounting` e `contas_ativas = 0`.
9. Informe somente esse resultado ou o erro. Não compartilhe chaves, senhas ou dados de pessoas.

Alternativa usando a cópia extraída do GitHub, no Git Bash:

```bash
notepad.exe supabase/migrations/20261104000100_initial_accounts.sql
```

Copie todo o texto do Bloco de Notas para o SQL Editor. Para a verificação, abra `supabase/verify.sql`. Esses comandos só abrem arquivos; não aplicam nada sozinhos.

## O que esta versão cria

- `public.menchat_profiles`: identidade ligada a `auth.users`, nome/status/foto (caminho futuro de Storage, não URL pública), código automático, preferências e estado `pending`, `active` ou `disabled`.
- `menchat_private.invitations`: hash SHA-256 do token, e-mail vinculado, usuário pendente, remetente, validade, revogação e consumo. Não guardar o token original. Expirados ainda pendentes precisam ser revogados antes de emitir substituto; a futura operação administrativa fará isso em transação.
- `menchat_private.app_state`: contador transacional de contas ativas, com máximo de 20 incluindo administradores.
- `menchat_private.schema_migrations`: registro da versão aplicada pelo SQL Editor. Não é a tabela de histórico da CLI Supabase. Quando adotarmos a CLI, conciliar esse histórico antes de tentar aplicar a mesma migração novamente; não usar `db push` às cegas.

Perfis não são criados automaticamente quando surge um usuário Auth. O futuro servidor vai provisionar contas pendentes de convidados. Não adicione usuários manualmente nem marque perfis como ativos no Table Editor nesta etapa. A primeira conta administrativa será definida em uma entrega própria, vinculada ao e-mail do proprietário confirmado, sem dar privilégios a quem se cadastrar primeiro.

## Proteções e limites desta entrega

- Todas as quatro tabelas têm RLS. Grants padrão amplos são removidos explicitamente.
- `anon` não lê/escreve perfis; `authenticated` só lê/edita o próprio perfil ativo, em campos específicos. Não pode mudar código, identidade, data de criação, estado ou papel administrativo, criar/excluir perfis ou ler os registros de convite. Conta pendente, desativada ou sem identidade não acessa perfis.
- O código é gerado no banco com seis letras/números, índice único e criação serializada. Não serve como convite ou senha.
- Trigger com `search_path` fixo mantém o código imutável e o contador. A cota usa atualização atômica; ativações simultâneas não ultrapassam 20. Desativar/excluir uma conta libera vaga. A chave de serviço não recebe UPDATE direto do contador nem EXECUTE nas funções internas.
- `service_role` é um poder administrativo que ignora RLS. Nunca irá para o cliente. A segurança da futura API depende também de validar a identidade/papel de quem chama; ter os campos de convite no banco não implementa essa autorização.
- Esta migração **não** garante ainda aceite de convite com uso único, OTP independente, expiração/revogação no fluxo, ou limite de tentativas. Os campos e constraints preparam o modelo; a operação atômica de aceitação e seus testes serão implementados na integração Auth. Não há endpoint de aceite nesta versão.
- Não há busca de contatos/perfis alheios, tabelas de conversa/mensagem, bucket de Storage, Realtime nem PWA nesta base. A interface continua na demonstração local. O acesso a perfis alheios deverá usar uma API que omita códigos ocultos, não SELECT irrestrito da tabela.
- Alterações diretas pelo administrador do banco podem contornar proteções. Não truncar tabelas nem editar o contador; manutenção deverá respeitar as invariantes. Não alteramos configurações globais de Auth, Storage ou grants de outros objetos do projeto.

## Testar antes de aplicar

Para desenvolvimento, com Node.js 24 e Docker em execução:

```bash
npm run test:db
```

O runner cria um PostgreSQL 17 descartável, sem portas publicadas e sem rede, simula somente os papéis `anon`, `authenticated`, `service_role`, `auth.users` e `auth.uid()`, aplica a migração e testa RLS/privilégios, mutações proibidas, contas pendentes, códigos, constraints de convites, cota e 21 inserções simultâneas. Remove o container no fim. Pode baixar `postgres:17` se ainda não estiver instalado. Não conecta ao seu Supabase nem usa `.env.local`. Não execute `bootstrap.sql` ou `accounts.sql` no seu projeto real.

Isso testa PostgreSQL/RLS com identidades simuladas. Não substitui testes no Supabase hospedado, JWT real, PostgREST, e-mail e canais Realtime. `npm run supabase:check` continua testando apenas Auth/HTTP; use `verify.sql` para verificar a base aplicada.

Referência: [RLS e grants no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
