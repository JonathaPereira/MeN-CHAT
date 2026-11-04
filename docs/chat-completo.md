# Interface, grupos, perfil, arquivos e voz

Esta entrega conecta as funções à área protegida `/conta/chat`. Você pode conferir tudo com sua própria conta antes de convidar outras pessoas. As rotas antigas `/conversas` e `/perfil` continuam sendo um protótipo independente, acessível pelo endereço, sem links de demonstração na área real.

## Ativar no seu projeto

1. Aguarde o deploy da versão atual na Vercel ficar **Ready**.
2. No projeto **MenChat** do Supabase, abra **SQL Editor → New query**.
3. Confira que as migrações 1–4 já foram aplicadas. Se a versão 4 ainda faltar, siga o guia de convites para aplicar aquele SQL; não é necessário gerar convites ou configurar a secret para testar esta entrega.
4. Copie todo o arquivo [`20261104000500_complete_chat.sql`](../supabase/migrations/20261104000500_complete_chat.sql), cole e clique em **Run**, uma vez. Ele preserva contas, códigos e textos privados existentes, estende as tabelas e cria dois buckets **privados**.
5. Execute [`verify-complete-chat.sql`](../supabase/verify-complete-chat.sql). O resultado esperado é **CHAT_COMPLETO_OK**. O verificador confere estrutura/permissões; não substitui upload real pelo aplicativo.
6. Abra [as conversas](https://men-chat.vercel.app/conta/chat). Recarregue a página se ela estava aberta durante o deploy.

Não execute `supabase/tests/` no banco hospedado. Não altere manualmente `storage.objects` para apagar arquivos: use a API/gestão de Storage para remover também os bytes armazenados.

Esta entrega usa URL e chave publicável já configuradas e a sessão do usuário. `SUPABASE_SECRET_KEY` permanece exclusiva do servidor para convites; grupos, perfil e uploads não precisam de uma nova chave administrativa.

## Testar sozinho, sem convites

1. Clique no ícone de **grupo** ao lado de Conversas. Dê o nome **Meu teste**, deixe os códigos vazios e clique em **Criar grupo**. Você será o único participante.
2. Envie texto; recarregue para conferir a persistência. Enter envia e Shift+Enter quebra linha, conforme sua preferência.
3. Use o **clipe** para escolher uma foto, confira a prévia e envie. Depois teste vídeo, PDF e um arquivo de áudio. Uma mídia por mensagem; ouvir no player não salva o arquivo em Downloads.
4. Clique no **microfone**, permita o acesso e grave. Clique na **seta** para enviar diretamente. Parar para ouvir é opcional; a lixeira descarta. O limite de gravação é 2 minutos. Gravação exige HTTPS/localhost e suporte do navegador; pelo Wi-Fi em HTTP, anexe um áudio do aparelho.
5. Abra seu **avatar → Meu perfil**, altere nome/status e escolha uma foto. Salve, volte ao chat e recarregue para conferir persistência. Foto de até 2 MB é recortada ao centro e convertida para 256 × 256, até 200 KB. O código pessoal é automático e imutável.
6. Na **engrenagem**, teste aparência, tamanho do texto, Enter, reprodução dos áudios, economia de dados, prévias e avisos. As preferências de aparelho são locais; privacidade é salva no perfil da conta.
7. Clique no nome do grupo para renomeá-lo e ver os participantes. O grupo solo serve para testar o funcionamento; sair dele encerra seu acesso, sem apagar o histórico no banco.

Não há resposta automática na área real. O selo de sincronização descreve a conexão; não declara outra pessoa online. Num grupo só seu, as mensagens mostram confirmação de gravação no servidor, sem inventar recebimento por terceiros.

## Grupos e privacidade

- Qualquer conta ativa pode criar até 32 grupos; cada grupo admite até 20 participantes. Códigos adicionam apenas contas já ativas que permitam busca; não convidam alguém para o aplicativo.
- Administradores podem adicionar, renomear e promover. Administradores comuns removem apenas membros comuns; o proprietário também gerencia administradores.
- Criador original e proprietário são protegidos contra remoção/rebaixamento por outro. Transferir o grupo não muda o criador.
- O proprietário transfere para um participante ativo antes de sair se houver outras pessoas. Sair é voluntário; um grupo solo pode ser encerrado saindo.
- Quem entra ou é readicionado recebe acesso ao histórico completo. Quem sai ou é removido perde consultas e envios, inclusive dos anexos. Isso não apaga o que já foi visto, salvo ou baixado.
- Administradores do aplicativo não recebem acesso global às mensagens privadas ou aos grupos dos quais não participam.
- Mutações do grupo e envios são serializados no banco para evitar remoção/envio concorrentes com autorização antiga. Busca privada mantém 15 tentativas/minuto; busca usada por grupos admite 30 no mesmo contador.

## Arquivos e limites

| Tipo                           | Limite por arquivo |
| ------------------------------ | ------------------ |
| Foto JPG, PNG, WebP, GIF       | 5 MB               |
| Vídeo MP4, WebM, QuickTime     | 25 MB              |
| Áudio MP3, M4A, OGG, WAV, WebM | 10 MB              |
| PDF, TXT, ZIP, Word, Excel     | 10 MB              |
| Foto de perfil normalizada     | 200 KB             |

Uma mídia por mensagem. Limite de reservas por pessoa: **100 MB/dia** e cinco envios ainda não concluídos na última hora. Capacidade reservada do MenChat: **500 MB**, imposta transacionalmente. Estes limites são do aplicativo; plano, tráfego/egress e cotas do seu Supabase continuam valendo. Nenhum Cloudflare foi provisionado. Não há verificação antivírus nem garantia de reprodução de todo codec que caiba num contêiner permitido.

O banco reserva o caminho por usuário; o upload não sobrescreve objetos. A publicação confere objeto, tipo e tamanho informados pelo Storage e usa UUID para repetir envio sem duplicar. Uma resposta perdida mantém a mídia no compositor para tentar novamente. Remover/trocar um rascunho tenta limpar a reserva; arquivos publicados são protegidos contra exclusão pelo cliente.

Prévia/download usa URL assinada de até **5 minutos**. Se ela expirar, use recarregar prévia ou baixar novamente. Uma URL já emitida pode funcionar até expirar após remoção do grupo; links baixados/compartilhados não são revogação de conteúdo já recebido. Buckets nunca são públicos. Fotos de perfil só são visíveis ao próprio usuário e a pessoas com uma conversa/grupo compartilhado autorizado.

Reservas/objetos abandonados após fechar a aba, perda de rede ou falha ambígua podem exigir limpeza administrativa. Não há limpeza automática agendada nesta entrega; antes da distribuição, definir retenção e limpeza de objetos/reservas, monitorar cotas e testar backup/restauração. Excluir só uma linha de `storage.objects` não remove o arquivo físico.

## Digitação, recebimento e leitura

O aplicativo registra a última sequência recebida e, com a conversa visível/focada no fim do histórico, a última sequência lida. A digitação expira em 6 segundos; metadados são consultados a cada 3 segundos e não representam presença contínua. Nomes e avatares identificam quem está digitando.

Um visto significa salvo no servidor; dois, recebimento confirmado por todos os outros participantes atuais; a cor de leitura depende da confirmação de todos que compartilham leitura. Toque no ícone para consultar por pessoa. Na política atual, a lista de confirmações usa os participantes atuais do grupo, não um cadastro histórico de destinatários por mensagem. Desligar leitura/digitação no perfil impede a exposição desses dados nas consultas.

Avisos usam a lista de conversas e as preferências existentes; a primeira carga do histórico não gera avisos antigos. Sons e notificações do navegador dependem de permissão e interação. Não há push com aplicativo fechado nem criptografia ponta a ponta nesta versão.

## Validação e limites dos testes

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run test:e2e`: regras, rotas protegidas e regressão do protótipo/interface anterior.
- `npm run test:db`: PostgreSQL 17 descartável com fixtures de Auth/Storage; testa RLS, grupos, conta desativada, privacidade, mídia, repetição e concorrência. Storage HTTP, bytes físicos e JWT real não são emulados pelo banco.
- `npm run test:real-ui`: interface real em desktop, celular e 320 px com Auth/HTTP fictícios, domínio reservado `menchat.invalid`, processo isolado e microfone sintético. Testa controles, áudio, mídia, perfil e responsividade; não é validação do provedor hospedado. O preload de teste nunca é importado pela aplicação e não altera autorização de produção.

Na nuvem, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` antes do comando do Playwright. Deixe as portas 3100, 3102 e 3106 livres e execute as suítes sequencialmente. Os testes de desenvolvimento e UI real usam o mesmo diretório de compilação de `next dev`.

Os passos de teste solo acima validam o Storage/Auth reais sem convidar ninguém. Posteriormente, uma conferência com duas contas já existentes verificará entrega entre dispositivos; convites novos e distribuição ficam para depois de sua revisão.
