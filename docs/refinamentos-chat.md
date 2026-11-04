# Mídia, câmera, respostas e navegação

Esta atualização preserva contas, conversas, anexos, convites, grupos, perfil e instalação da entrega anterior. Acrescenta respostas, menções e favoritos, além de simplificar a apresentação da mídia.

## Ativação no projeto existente

1. Abra o projeto **MenChat** no [Supabase](https://supabase.com/dashboard) → **SQL Editor** → **New query**.
2. Com as versões 1–6 já aplicadas, copie o conteúdo completo de [20261104000700_chat_refinements.sql](../supabase/migrations/20261104000700_chat_refinements.sql) e clique **Run**, uma única vez. Não reaplique migrações antigas e não execute os arquivos de `supabase/tests` no banco real.
3. Aguarde a publicação na Vercel ficar **Ready**, abra https://men-chat.vercel.app/conta/chat e atualize. Nenhuma variável ou chave nova é necessária.

O SQL é incremental: adiciona referências a mensagens e participantes, favoritos privados e funções com validação no banco. Não recria contas nem apaga histórico. A versão nova usa essas funções para enviar mensagens; aplique o SQL para habilitar os envios desta publicação.

## Usar os recursos

- **Áudio:** reproduzir/pausar, barra de posição, tempo e botão de baixar. O nome do arquivo e o menu nativo foram retirados. A velocidade segue Configurações → Conversas e voz. Quando o formato não informa a duração, a posição pode ficar indisponível até o navegador conhecê-la.
- **Foto:** toque na imagem para ampliar. Use +/− para zoom e deslize a área ampliada; o botão de baixar continua disponível. O balão não mostra o nome do arquivo. Documentos continuam mostrando seus nomes para identificação.
- **Câmera:** ao lado do clipe, toque no ícone de câmera → Abrir câmera. Tire uma foto ou grave um vídeo com som e conclua. Confira o anexo e envie pela seta. Há também “Escolher do aparelho”. Fechar ou concluir libera câmera e microfone.
- **Responder:** botão ⌄ da mensagem → Responder. Uma referência aparece no compositor e no balão enviado; × cancela antes de enviar.
- **Marcar:** ⌄ → Marcar mensagem. A estrela no cabeçalho abre as últimas 200 mensagens marcadas da conversa. Os favoritos pertencem à sua conta; outros participantes não recebem sua marcação.
- **Mencionar:** no grupo, digite @ ou toque no botão @ e escolha a pessoa. O envio guarda o ID do participante, além do texto visível. Não há uma notificação push separada por menção nesta entrega.
- **Digitação:** nome, avatar e pontos animados aparecem junto aos balões, além do cabeçalho. O aviso respeita a privacidade do participante e desaparece após a expiração do sinal.

O banco rejeita respostas a outra conversa, mensagens apagadas/ocultas e menções a quem não participa atualmente do grupo. A citação não salva uma cópia do texto original: se a fonte ficar indisponível, a referência mostra “Mensagem indisponível” após sincronizar. O texto que alguém já leu ou copiou não pode ser recolhido.

## Câmera e compatibilidade

Na publicação HTTPS, o navegador pede permissão apenas ao abrir a câmera; o microfone é solicitado ao gravar vídeo. A captura direta depende de `getUserMedia`/`MediaRecorder`. Em HTTP pelo IP da rede local, use “Escolher do aparelho”, ou a publicação HTTPS. Permissões, formatos e acesso à câmera variam entre navegadores. O seletor de arquivos continua sendo a alternativa quando a captura não é suportada.

Fotos capturadas são JPEG, no máximo 2048 px no maior lado, até 5 MB. Vídeos capturados têm limite de 2 minutos e 25 MB. Os limites gerais do Storage e da versão anterior continuam válidos. URLs assinadas duram até 5 minutos; o app tenta renovar automaticamente uma prévia que falhou e apresenta erro se não conseguir. Não há mais botão de recarregar a mídia.

## Navegação e validação

Perfil e configurações abrem em uma janela sobre o chat. O histórico permanece montado, o rascunho é preservado e a abertura de configurações não faz uma nova requisição de página nem nova validação Auth. Os endereços diretos continuam protegidos pelo servidor.

As páginas de chat/perfil reutilizam a consulta validada do perfil próprio, sem uma segunda consulta igual. A sincronização evita repetir confirmações de leitura sem alteração, executa consultas independentes em paralelo e reduz consultas quando a aba está oculta. Prévias já montadas não são recriadas a cada consulta. Não se usa cache público de dados privados nem se reduz a verificação de identidade.

`npm run test:db` verifica isolamento de respostas, autorização de menções e favoritos pessoais, além dos controles anteriores. `npm run test:real-ui` testa mídia, câmera e liberação de dispositivos, menus, rascunhos e interações nos três tamanhos. A medição local com serviços fictícios não comprova a latência da Vercel/Supabase. Câmera física e integração hospedada precisam ser conferidas após a aplicação do SQL pelo proprietário.

O botão ⌄ fica no canto superior direito do balão e abre um menu local, sem bloquear o chat. A opção Responder aceita texto e todos os tipos de mídia. Para o APK e push, consulte [Android e notificações](android-e-notificacoes.md).
