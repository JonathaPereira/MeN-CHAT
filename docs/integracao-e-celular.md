# Integração do MenChat e versão para celular

Este é o roteiro de execução das próximas etapas, com uma entrega verificável por vez. A versão atual ainda é uma demonstração local: preencher `.env.local` não ativa login, mensagens ou convites reais. Não publique esta demonstração como se já fosse um chat privado.

A ordem recomendada é Supabase → login por convite → conversas reais → mídia → publicação HTTPS → instalação PWA → push. A mesma aplicação atende computador e celular. APK/App Store não são necessários para começar.

## 0. Manter uma cópia atualizável no Windows

Se você usa Download ZIP, extraia cada versão em uma pasta própria; não execute `git pull` nessa cópia. Para passar a atualizar com Git, abra o Git Bash na pasta onde deseja guardar o projeto e clone em uma **nova pasta que ainda não exista**:

```bash
git clone https://github.com/JonathaPereira/MeN-CHAT.git MenChat-git
cd MenChat-git
npm ci --cache "$LOCALAPPDATA/npm-cache"
npm run build
npm start -- --hostname 0.0.0.0 --port 3001
```

Abra `http://127.0.0.1:3001/conversas`. Mantenha o terminal aberto. Se a porta estiver ocupada, pare o servidor anterior com Ctrl+C ou escolha outra porta. Só dentro dessa cópia clonada, futuras atualizações usam `git pull --ff-only`, com o servidor parado e após revisar alterações locais. A cópia ZIP anterior pode ser mantida como referência.

## 1. Criar o projeto de teste no Supabase — primeiro passo agora

O que você faz:

1. Entre em [supabase.com/dashboard](https://supabase.com/dashboard), crie uma organização se necessário e escolha **New project**.
2. Nomeie o projeto de teste, escolha a região e guarde a senha do banco em seu gerenciador de senhas. Não envie essa senha pelo chat nem coloque no GitHub.
3. Espere o projeto ficar pronto. No painel de conexão/API, localize a **Project URL** e a **publishable key** (`sb_publishable_...`). Os nomes dos menus podem variar. Não copie `sb_secret_...`, `service_role`, senha do banco ou URL com senha para variáveis públicas.
4. Em Authentication, desative a opção que permite novos cadastros públicos. A integração deverá usar apenas identidades provisionadas pelo administrador.
5. No Git Bash da pasta do projeto, copie o exemplo, se ainda não existir `.env.local`:

```bash
cp -n .env.example .env.local
notepad.exe .env.local
```

Preencha **localmente**, mantendo os nomes:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
```

6. Salve o arquivo. `.env.local` é ignorado pelo Git; não o adicione com `git add -f`. A senha do banco e a chave administrativa não entram nesse arquivo de exemplo.
7. Para continuarmos, basta informar que o projeto de teste foi criado. Se formos configurar um ambiente de execução remoto, use o mecanismo de variáveis/segredos desse ambiente; o arquivo do seu Windows não é transferido automaticamente.

O que eu implementarei na entrega seguinte: configuração validada, esquema inicial versionado em migrações, tipos do banco e verificações locais de conexão. Não usaremos banco com dados reais para experimentar migrações. As fábricas Supabase atuais ainda estão inativas.

Conclusão da etapa: conexão de teste validada e esquema revisável; não confundir abrir a tela de demonstração com testar acesso ao banco. Se já houver um projeto com dados reais, primeiro identificar esquema e fazer cópia de segurança antes de qualquer migração.

## 2. Login, perfis e convite de uso único

O que implementarei:

1. Cliente SSR oficial do Supabase, cliente de navegador e renovação de sessão em `proxy.ts` conforme a versão instalada do Next. Validar identidade no servidor; não confiar somente na existência de cookies ou no estado do React.
2. Provisionamento administrativo de conta pendente e convite com token aleatório armazenado como hash, e-mail fixo, expiração e revogação. O token de convite não é o código público de seis caracteres.
3. No aceite, enviar **uma nova verificação independente** ao e-mail convidado. O link encaminhado sozinho não autentica a conta. Com cadastro público desligado, usar apenas conta previamente provisionada e não criar outra por OTP (`shouldCreateUser: false`). A configuração concreta de OTP, templates, redirecionamentos e senha será validada nessa etapa.
4. Consumir convite e ativar perfil numa transação, com limite global de 20 contas ativas, inclusive sob concorrência. Conta pendente não recebe acesso ao chat.
5. Gerar código alfanumérico de seis caracteres no servidor, com unicidade no banco e repetição em caso de colisão. Busca autenticada, limitada e condicionada à privacidade.
6. Proteger páginas e operações. Bloquear o fluxo AMIGOS20 fora da demonstração. Não misturar conversas fictícias com contas reais; deixar o modo de demonstração explicitamente separado.

O que você configurará comigo: domínio/URL de redirecionamento de teste, remetente e serviço de e-mail transacional/SMTP para os convites. Credenciais administrativas somente no servidor e no armazenamento de segredos da hospedagem, nunca em `NEXT_PUBLIC_` ou no repositório.

Conclusão: convidado certo entra; e-mail diferente, convite repassado sem OTP, expirado, revogado ou já usado falham. Duas aceitações simultâneas não criam duas ativações. Cadastro público e usuários pendentes não leem dados. Compartilhar voluntariamente também o e-mail/OTP ou a senha continua possível; não há promessa de impedir isso.

Detalhes: [Convites e privacidade](convites-e-privacidade.md).

## 3. Mensagens privadas e grupos reais

1. Criar tabelas para conversas, membros, mensagens, perfis privados/públicos, preferências e confirmações de leitura. Chaves, índices e constraints em migrações revisáveis, nunca SQL avulso sem histórico.
2. Definir RLS e operações transacionais: privado tem exatamente dois participantes; grupo tem somente seus membros ativos. Busca de perfil não abre histórico alheio. Código oculto não deve sair na resposta pública da API.
3. Impor no banco as regras de dono/admin/criador. `creator_id` é imutável, ninguém remove o criador, dono transfere antes de sair quando há outros membros. Associações, limite e transferências são atômicos.
4. Adotar inicialmente: novo membro de grupo vê somente mensagens a partir da entrada; quem sai/perde acesso não busca mensagens nem novas URLs de mídia. Conteúdo já baixado no aparelho não pode ser recuperado remotamente. Registrar momentos de entrada/saída para aplicar a regra também no Storage e no Realtime.
5. Realtime em canais privados por conversa, autorização no servidor, reconexão, paginação e idempotência de envios. Não assinar uma tabela global e filtrar só no frontend.
6. Digitação expira e identifica o autor autenticado. Cada pessoa registra somente sua própria leitura, respeitando a privacidade.
7. Bola de neve é um evento persistido, com unicidade `(conversation_id, sender_id)` no banco. Exigir participação e aceitar **uma vez por pessoa em cada conversa**, mesmo após recarregar, em outro aparelho ou em duas requisições simultâneas. Remover/reinserir membro não apaga esse registro. O evento só alerta os destinatários autorizados.
8. Reexibir histórico ou reconectar não pode repetir avisos, animações ou vibrações: deduplicar por ID de evento. Silenciamento e configurações do destinatário prevalecem.

Conclusão: duas contas reais conversam em dois dispositivos; uma terceira conta falha ao tentar ler/inserir mensagens, eventos, leituras ou mídia por API direta. Remoção de grupo bloqueia envio e acesso no servidor, inclusive em canais já abertos. Reiniciar o navegador preserva o histórico autorizado e a cota de bola de neve. RLS não equivale a criptografia ponta a ponta; isso não está implementado.

## 4. Fotos, áudios, vídeos e figurinhas reais

1. Começar com Supabase Storage **privado**, para centralizar a autorização junto do Auth/PostgreSQL. Cloudflare R2 fica como alternativa posterior, após medir uso; não é obrigatório contratar os dois.
2. Criar políticas por conversa/membro, uploads autorizados e downloads com URLs de curta validade. Evitar chaves de Storage/R2 no cliente.
3. Validar conteúdo, tamanho e tipo no servidor/provedor, limitar uso por pessoa e definir retenção, exclusão e limpeza de arquivos órfãos. Os limites do protótipo não são quotas contratadas.
4. Sincronizar metadados e figurinhas; decidir quais mídias manter no dispositivo. Tratar erros, perda de conexão, cancelamento e repetição sem duplicatas.
5. Rever limites e preços vigentes no painel dos serviços escolhidos antes de liberar usuários. Vídeos têm custo de armazenamento e transferência e precisam de orçamento; não prometemos uso ilimitado.

Conclusão: mídia funciona entre aparelhos e um usuário externo ao grupo não consegue fazer upload/download ou obter URL assinada. Figurinhas continuam WebP estático de 512 × 512 e até 100 KB. Microfone real exige HTTPS ou localhost.

## 5. Publicar o ambiente de teste em HTTPS

1. Escolher hospedagem com servidor Next.js. Recomendo começar pela integração GitHub da Vercel para reduzir configuração. Revisar plano/custos antes de publicar; este projeto **não** é exportação estática.
2. Se preferir Cloudflare, usar Workers com adaptador OpenNext e testar a compatibilidade com esta versão do Next antes de escolher. Cloudflare Pages estático não substitui o servidor de autenticação/API. DNS Cloudflare pode ser usado independentemente da hospedagem.
3. Configurar variáveis e segredos no painel da hospedagem, URLs de Auth/redirecionamento e remetente de e-mail. Usar projeto Supabase de teste separado do projeto de produção. Evitar URLs de preview não confiáveis nos redirecionamentos.
4. Revisar políticas, limites, logs sem conteúdo privado/segredos, backups e restauração. O administrador aprova o domínio e a liberação de convidados após os testes.
5. Publicar somente a versão com proteção real; abrir o endereço HTTPS em Windows e celular. Não depender do IP da rede doméstica para o uso normal.

Conclusão: login, sessão, mensagens, mídia e saída funcionam no domínio de teste, fora do Wi-Fi de casa. Usuário não autenticado não lê conversas. Produção é uma entrega posterior, após revisão e validação da versão de teste.

## 6. Instalar no Android e iPhone como PWA

O que implementarei: manifest com nome/ícones/start URL/display standalone, ícones apropriados, apresentação em tela cheia útil, estados de rede e service worker com atualização controlada. Não fazer cache indiscriminado de páginas autenticadas, mensagens, respostas de API ou URLs assinadas. Limpar dados sensíveis ao sair. Offline completo fica para uma etapa específica; um PWA não torna o backend offline automaticamente.

Depois da publicação HTTPS e da entrega do PWA:

1. **Android/Chrome:** abrir o domínio, menu do navegador → Instalar app ou Adicionar à tela inicial (o texto varia).
2. **iPhone/Safari:** abrir o domínio, Compartilhar → Adicionar à Tela de Início; abrir pelo novo ícone.
3. Testar teclado aberto, área segura, orientação, gravação, anexo da galeria, permissões, atualização e logout. Testar em aparelhos físicos, além do navegador automatizado.

Conclusão: abre pelo ícone em janela própria e usa as mesmas contas e conversas da web. Isso não gera APK nem publicação na Play Store/App Store. Se ainda quiser um app de loja, avaliar Capacitor ou cliente nativo em etapa separada, reutilizando o backend; empacotar o Next sem avaliar recursos de servidor não é suficiente.

## 7. Push e vibração no celular

1. Implementar registro do service worker, inscrição Web Push por dispositivo e pedido de permissão por gesto explícito. Manter a chave privada de envio no servidor.
2. Servidor entrega somente a destinatários autorizados, deduplica eventos, respeita silenciamentos e evita conteúdo privado na tela bloqueada por padrão. Limpar inscrições expiradas/revogadas e no logout; não reutilizar inscrição entre contas.
3. Validar aba aberta, em segundo plano e fechada, rede instável, permissões negadas e modo silencioso. Push não tem garantia de entrega imediata.
4. No iOS, Web Push depende de versão compatível e app adicionado à tela inicial (a partir do iOS/iPadOS 16.4). Isso **não** habilita a API de vibração: Safari/iPhone não oferece `navigator.vibrate`. No Android o navegador/aparelho também pode ignorar o pedido, sobretudo em segundo plano. Não prometer vibração personalizada universal; comportamento de alertas do sistema depende do SO. Haptics nativos exigem avaliação separada de app nativo.

Conclusão: usuários compatíveis recebem push autorizado com o app fechado; quem bloqueou ou não tem suporte vê uma alternativa clara ao abrir o app. Não mostrar “ativado” só porque o código chamou uma API.

## Referências oficiais para cada entrega

- [Supabase + Next.js SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Configuração do Auth](https://supabase.com/docs/guides/auth/general-configuration)
- [RLS no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Autorização do Realtime](https://supabase.com/docs/guides/realtime/authorization)
- [Storage e controle de acesso](https://supabase.com/docs/guides/storage/security/access-control)
- [Next.js PWA](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Next.js na Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [API de vibração e compatibilidade](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)

Revalidar a documentação, as versões instaladas e as condições do plano no início de cada entrega. Nenhum serviço foi provisionado, migração aplicada, segredo configurado ou deploy realizado ao escrever este roteiro.
