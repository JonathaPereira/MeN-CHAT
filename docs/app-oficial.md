# MenChat oficial e instalação no Android

Esta entrega adiciona a PWA instalável, loading com a marca, mensagens apagadas, contagem de não lidas e contato de quem convidou. Grupos, admins e fotos de perfil continuam usando a migração 5.

## Ativar

1. Aguarde a nova versão ficar Ready na Vercel.
2. No SQL Editor do projeto MenChat, aplique uma vez `supabase/migrations/20261104000600_official_app.sql`, depois das versões 1–5. Não reaplique as anteriores.
3. Abra https://men-chat.vercel.app/conta/chat e atualize a página. Não é necessária uma variável secreta nova.

## Android

Abra o endereço HTTPS no Chrome. Em Configurações do MenChat, quando o navegador oferecer, aparece “Instalar MenChat”. Também é possível usar o menu ⋮ do Chrome → Instalar aplicativo / Adicionar à tela inicial. O navegador decide quando disponibilizar a instalação. A PWA abre em janela própria, com ícone e tela de abertura derivados da marca. Não é um APK nem publicação na Play Store.

O service worker usa a rede e mostra uma página genérica ao abrir sem conexão. Não usa Cache Storage para HTML privado, tokens, mensagens ou anexos. Não oferece leitura/envio offline nem push com o app fechado. Um aviso de atualização permite recarregar manualmente; envie seus rascunhos antes de atualizar. Permissões de câmera/arquivos/microfone continuam sob controle do Android e do navegador.

## Mensagens e não lidas

- Apagar para mim oculta a mensagem na conta, em todos os seus aparelhos, sem afetar os outros participantes.
- Apagar para todos fica disponível apenas ao autor, sem prazo nesta versão. Retira texto/anexo do histórico servido pelo aplicativo e mantém “Mensagem apagada.”. Não remove cópias já baixadas. URLs de mídia emitidas antes podem permanecer válidas até expirar (5 minutos).
- O objeto físico e sua reserva permanecem para limpeza administrativa; apagar mensagem não libera imediatamente a cota de armazenamento. Não há agendamento de exclusão física nesta entrega.
- Não lidas contam mensagens de outras pessoas ainda não vistas, excluindo apagadas/ocultadas. Abrir com foco no fim do histórico atualiza o cursor da conta, independentemente de compartilhar confirmação de leitura.
- Alterações de histórico e contador sincronizam periodicamente; ao reconectar, a lista é consultada novamente.

## Convite e perfil

Após confirmar o convite e ativar a conta, a lista exibe nome e código de quem convidou, com botão de iniciar conversa. É mostrado apenas ao destinatário autenticado, enquanto ainda não há privado entre os dois. Respeita visibilidade do código e busca do perfil do administrador; habilite essas duas opções se quiser que novos convidados vejam seu código. O link não publica seu código para visitantes anônimos.

Admins de grupo: clique no título do grupo → participante → Tornar admin. Fotos: avatar → Meu perfil → Foto → Salvar perfil. Os controles e permissões da migração 5 permanecem válidos.

## Validação

`npm run test:db` cobre exclusão por autor, ocultação pessoal, isolamento e contagem. `npm run test:real-ui` testa a interface com Auth/HTTP fictícios e microfone sintético em três tamanhos. `npm run test:e2e` cobre somente rotas oficiais, manifesto, worker e convites; os antigos testes do protótipo estão preservados no repositório, fora da suíte oficial. `npm run test:dev` verifica hidratação e origens locais. Lint, tipos, build e testes de regras continuam obrigatórios.

A validação final no Supabase e a instalação em Android físico exigem a publicação e a migração aplicadas pelo proprietário. Não equivalem aos testes locais. Antes de distribuir, confira também o funcionamento em dois aparelhos com sua própria conta.
