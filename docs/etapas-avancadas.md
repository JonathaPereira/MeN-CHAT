# Próximas entregas do MenChat

Trabalhar em uma entrega por vez, com revisão antes de avançar. O chat de demonstração `/conversas` não é o chat real `/conta/chat`. Login e texto privado já foram testados pelo proprietário em produção; os recursos abaixo precisam de suas próprias validações.

## Qualidade — critérios de cada entrega

1. **Autorização:** testar conta anônima, membro, administrador e conta desativada; acesso a conversas de terceiros deve ser negado no banco. Chave administrativa somente no servidor.
2. **Confiabilidade:** repetição sem duplicação, falha de rede, reconexão, expiração e ações concorrentes. Evitar indicadores que afirmem entrega/leitura sem confirmação real.
3. **Uso:** desktop, celular e tela de 320 px; teclado, foco, contraste, tema escuro e redução de movimento. Testar também em aparelhos físicos.
4. **Verificação:** lint, TypeScript, testes de regras, Postgres descartável quando houver SQL, build e navegador. Integrações com Auth/SMTP/Storage/Realtime hospedados precisam de teste com duas contas; mocks não substituem esse teste.

## Funcionalidade — ordem das entregas

| Etapa                             | Resultado                                                                                                                                                                                                          | Critério de conclusão                                                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 — Convites pelo MenChat        | Administrador gera/revoga convite por e-mail; convidado confirma OTP, cria senha e é ativado automaticamente como membro; código de seis caracteres é gerado no banco. Marca vetorial ajustada à proposta de logo. | Link repassado não libera outro e-mail; token só é usado uma vez; testar o fluxo no Supabase hospedado após configuração única. Implementação desta entrega.                                                                                          |
| F2 — Grupos reais                 | Criar grupo, adicionar membros ativos por código, promover administradores, remover participantes e sair. Criador original imutável e protegido, inclusive após transferência de dono.                             | RLS/transações impedem inclusão/remoção indevida e leitura por terceiros; definir acesso ao histórico ao entrar/sair; testar duas contas e concorrência.                                                                                              |
| F3 — Anexos e voz reais           | Clipe visível; upload privado de fotos, vídeos, documentos e áudios; gravação com um clique e envio direto; prévia antes de baixar.                                                                                | Bucket privado, autorização por conversa, limites de tamanho/tipo, URLs temporárias, limpeza de uploads incompletos e cotas. Validar consumo e custos antes de escolher Supabase Storage ou outra infraestrutura; nenhum Cloudflare foi provisionado. |
| F4 — Digitação, entrega e leitura | Avatar/nome com “digitando…” e animação discreta; ícones distintos para envio, falha, recebimento e leitura; “quem viu” nos grupos.                                                                                | Canal privado autorizado, digitação expira mesmo ao cair a conexão; recebimento confirmado pelo destinatário e leitura conforme preferências; nenhum recibo simulado no chat real.                                                                    |
| F5 — Perfil e preferências reais  | Foto, nome, status, visibilidade/busca do código, privacidade, avisos e carregamento de mídia entre dispositivos.                                                                                                  | Atualizações autorizadas e preferências respeitadas pelo servidor e pelos demais participantes.                                                                                                                                                       |

Os limites de arquivos e as funções de grupos/voz/figurinhas já existentes no protótipo servem para testar a interface; não representam uploads ou grupos reais. Não colocar botões aparentemente funcionais no chat real antes de implementar a autorização correspondente.

## Distribuição

1. **D1 — Teste fechado:** manter a publicação HTTPS na Vercel, configurar variáveis por ambiente, aplicar migrações em ordem e convidar inicialmente uma pessoa. Verificar contas reais em computador e celular. Não usar o mesmo banco de produção em previews abertos.
2. **D2 — Operação:** registrar versão de cada migração, política de backup/restauração, cotas de banco/Storage/tráfego, monitoramento sem conteúdo privado, atualização de dependências e procedimento de revogação de acesso. Não prometer criptografia ponta a ponta: não foi implementada.
3. **D3 — PWA:** manifesto, ícones derivados da marca e instalação Android/iPhone. Não armazenar páginas ou mensagens privadas em cache público; definir sessão/offline e teste de atualização antes da liberação.
4. **D4 — Avisos com app fechado:** implementar push como entrega própria, com permissão explícita e preferências por conversa. Suporte depende do navegador/instalação; vibração não é universal, especialmente no iPhone.
5. **D5 — Aplicativo nativo, se necessário:** avaliar depois do teste da PWA. Não há APK/App Store nesta entrega.

Próximo passo desta versão: seguir [Convites pelo aplicativo](convites-pelo-aplicativo.md) e validar um novo convite. As demais etapas não são iniciadas automaticamente.
