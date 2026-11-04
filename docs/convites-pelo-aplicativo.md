# Convites pelo aplicativo — configuração única

Você deixa de criar e ativar cada amigo no painel. O administrador gera o convite dentro do MenChat; a pessoa comprova acesso ao e-mail, escolhe a senha e recebe perfil ativo de membro, com código automático. O cadastro público continua desativado.

Esta entrega sucede o texto privado da migração 3. Não cria o primeiro administrador: mantenha o seu administrador já ativado e os usuários existentes.

## 1. Aplicar a nova migração no Supabase

1. Abra [o painel do Supabase](https://supabase.com/dashboard), selecione **o projeto do MenChat** e vá a **SQL Editor → New query**.
2. Abra [`20261104000400_managed_invitations.sql`](../supabase/migrations/20261104000400_managed_invitations.sql), copie **todo** o conteúdo, cole no editor e clique em **Run**. Aplique somente esta nova migração; não repita as anteriores. Se as migrações 1–3 ainda não estiverem aplicadas, siga primeiro os guias de banco e conversas reais.
3. Execute o conteúdo de [`verify-invitations.sql`](../supabase/verify-invitations.sql). O resultado esperado é **CONVITES_OK**.

Não execute arquivos de `supabase/tests/` no seu projeto. Eles criam fixtures e só pertencem ao banco descartável.

## 2. Configurar a Vercel uma vez

1. Abra [a Vercel](https://vercel.com/dashboard), selecione **men-chat → Settings → Environment Variables**.
2. Adicione para **Production**:

   | Nome                  | Valor                                                                   |
   | --------------------- | ----------------------------------------------------------------------- |
   | `SUPABASE_SECRET_KEY` | A chave **secret** do seu projeto Supabase, começando com `sb_secret_`. |
   | `MENCHAT_SITE_URL`    | `https://men-chat.vercel.app`                                           |

3. Para encontrar a chave: Supabase → seu projeto → **Project Settings → API Keys → Secret keys**. Crie/mostre uma secret key se necessário. Copie diretamente para o campo da Vercel, marque-a como sensível quando disponível e salve. Esta versão usa a chave secret atual, não a chave JWT legada `service_role`.
4. **Nunca** use `NEXT_PUBLIC_SUPABASE_SECRET_KEY`, nunca cole a chave em mensagens, arquivos versionados ou código do navegador. Mantenha as duas variáveis públicas já configuradas.
5. Na Vercel, abra **Deployments**, escolha a versão mais recente deste código e **Redeploy** após salvar as variáveis.

Para desenvolver localmente, use os mesmos nomes em `.env.local`, que é ignorado pelo Git, e `MENCHAT_SITE_URL=http://127.0.0.1:3001` se essa for sua origem local. Reinicie o servidor. Links locais não servem para pessoas fora da sua rede; para o teste com amigo, gere o link na publicação HTTPS.

Nenhuma mudança de SMTP é exigida se o código por e-mail já funciona. Mantenha o template **Magic Link** com `{{ .Token }}`, como no primeiro acesso. Limites de envio do Supabase e do seu provedor SMTP continuam valendo; falhas devem ser verificadas nos logs do painel, sem compartilhar tokens ou senhas. Cadastro público deve continuar **desativado**.

## 3. Convidar pelo MenChat

1. Entre na sua conta administrativa em [men-chat.vercel.app/entrar](https://men-chat.vercel.app/entrar).
2. Abra [Minha conta](https://men-chat.vercel.app/conta) → **Convidar pessoas**. Atalho: [Gerenciar convites](https://men-chat.vercel.app/conta/convites).
3. Digite o e-mail correto do amigo e clique em **Gerar convite**.
4. Copie o link e envie a ele pelo seu meio habitual. O MenChat envia o código quando o convidado o solicita; não envia o link de convite automaticamente.
5. O link só aparece nessa geração. Para recuperá-lo depois, gere outro para o mesmo e-mail: o anterior é revogado automaticamente.

O convite vale **72 horas**, uma vez, e pode ser revogado enquanto pendente. Contas ativas mais convites pendentes válidos reservam no máximo **20 vagas**, incluindo você. O provisionamento tem limite de **30 tentativas por administrador por hora**. Reemissão ocupa a mesma vaga. Convite não reativa uma conta desativada nem promove alguém a administrador.

## 4. O que seu amigo faz

1. Abre o link completo no navegador.
2. Informa o e-mail que você convidou e toca em **Receber código por e-mail**.
3. Usa o código mais recente recebido, informa nome e senha de pelo menos 12 caracteres e confirma em **Aceitar convite e entrar**.
4. A conta é ativada automaticamente como **membro** e abre as conversas reais. O código pessoal de seis letras/números aparece em **Minha conta**. Vocês podem buscar esse código para iniciar uma conversa.

O link contém o token após `#`; esse trecho não vai na requisição HTTP nem no Referer. A tela o retira do endereço após abrir e o mantém apenas na memória dessa página. **Se recarregar ou trocar de aparelho durante o aceite, abra novamente o link original.** Senha, OTP e token não são salvos pelo app no armazenamento local.

Um link encaminhado para outra pessoa não basta: ela precisa confirmar um novo código enviado ao e-mail vinculado. Isso não impede o próprio convidado de compartilhar intencionalmente o código ou a conta.

## 5. Teste real antes de convidar os demais

- Gere um convite para um e-mail novo que você controla ou para o amigo de teste. Confirme que não foi necessário usar **Add User**, `setup-member.sql` ou ativação manual.
- Sem a sessão de administrador, `/conta/convites` deve ser inacessível. Membros não podem gerar/listar/revogar convites.
- Peça o código usando outro e-mail: não deve ativar a conta. Não confunda a mensagem genérica de envio com confirmação de que um e-mail foi enviado.
- Reemita/revogue um convite pendente e confirme que o link anterior não ativa. Após aceitar, repetir o link deve falhar.
- Troquem mensagens privadas em dois aparelhos; saiam e entrem novamente para conferir persistência.
- Confira que o novo perfil é membro e o cadastro público permanece bloqueado.

Testes locais cobrem tokens, provisionamento simulado, autorização/RLS, cota e aceite concorrente no Postgres, além da interface responsiva. Não exercitam o serviço Auth, o JWT real, SMTP, Realtime ou Vercel. Só considere o fluxo hospedado validado depois desse teste.

## Em caso de falha

- **Migração ausente:** aplique a versão 4 e execute o verificador. Não crie perfis à mão para contornar erros.
- **Chave/configuração:** confira nomes e ambientes das variáveis e faça Redeploy. Não cole a chave no chat.
- **Conta antiga não confirmada no Auth:** o aplicativo se recusa a confirmá-la automaticamente; exige revisão administrativa para evitar habilitar uma identidade com senha preexistente desconhecida.
- **Conta Auth criada, mas convite falhou:** ela continua sem perfil ativo e sem acesso às conversas. Corrija a causa e gere novamente; o servidor reutiliza a identidade. Não a exclua automaticamente, pois uma resposta perdida pode esconder uma operação concluída.
- **OTP funcionou, mas o convite foi revogado ou a ativação falhou:** Auth e Postgres não compartilham uma transação. A senha pode já ter sido definida, mas o perfil continua sem acesso. Gere um novo convite e peça outro código; a ativação exige sessão com OTP recente (até 10 minutos).

Grupos, anexos, digitação e recibos **reais** seguem o [roteiro de etapas](etapas-avancadas.md). As versões desses recursos em `/conversas` continuam sendo demonstrações.
