# Paridade Android/web e chamadas

Objetivo solicitado: aproximar o Android da experiência completa da web, preservando contas, histórico, mídia e regras de acesso. O aplicativo continua exclusivo para convidados. Uma etapa só é considerada validada após as verificações correspondentes; compilação e testes simulados não comprovam funcionamento no Poco nem entre duas contas hospedadas.

## 1. Estabilidade — entrega 2.0.2

- Corrigir o filtro de visibilidade do histórico nativo: PostgREST exige `in.(...)`, enquanto o APK enviava `in(...)`, provocando HTTP 400 antes de apresentar o histórico.
- Testar a consulta HTTP real produzida pelo cliente, incluindo operador, IDs fictícios, token da conta, exclusão para todos e ocultação para mim.
- Corrigir duração web sem confiar no cabeçalho: um WebM da regressão contém dois segundos de áudio, embora declare 600 segundos. Mostrar o total apenas após conferir amostras decodificadas ao começar a ouvir.
- A conferência de áudio usa uma leitura adicional de até 10 MB por player ao ouvir, sem Cache Storage ou persistência em disco pela aplicação. Não repetir por polling nem por pausa/reprodução após verificação; abortar leitura ao desmontar. Se o formato não puder ser conferido, manter reprodução e duração desconhecida.
- Critério físico: abrir o privado e o grupo existentes, enviar texto/áudio, reabrir e conferir exclusão/ocultação. No site, ouvir o áudio afetado e conferir duração, pausa, busca e velocidade.

## 2. Interface Android baseada na web

- Reusar marca, paleta verde, tipografia, proporções de balões, hierarquia e menus leves da web como referência visual.
- Substituir a aparência genérica de cartões/formulários e emojis usados como ícones por componentes e ícones coerentes com o chat.
- Lista e conversa adaptadas ao celular; duas colunas quando houver espaço. Clipe, câmera, engrenagem e microfone à direita visíveis. Teclado, barras do sistema, rotação, fontes grandes e toque confortável.
- Perfil, busca por código, respostas, exclusão, leituras/digitação e não lidas preservados durante navegação.
- Critério: revisão visual em tamanhos pequenos/grandes, claro/escuro e Android físico, sem regressão dos envios.

## 3. Câmera, anexos, perfil e recursos da web

- Captura Android de foto/vídeo, galeria e documentos; prévia/descarte, retomada após permissão e liberação de recursos ao sair.
- Fotos 5 MB, vídeos 25 MB, áudio/documentos 10 MB; avatar normalizado conforme a política atual. Reservas, upload sem sobrescrita, confirmação e cotas continuam no servidor.
- Editar nome/status/foto e privacidade com as RPCs existentes. Ampliar fotos e reproduzir vídeo dentro do aplicativo.
- Completar administração de grupos, papéis e participantes, respeitando criador imutável, dono e administradores. Completar convites, favoritos, menções, emojis e figurinhas para alcançar a paridade funcional, sem apresentar botões de simulação como reais.
- Critério: criação/edição e ida/volta entre web e Android com a mesma conta, falhas de permissão/upload e conta removida do grupo.

## 4. Notificações Android e som próprio

- Integrar push nativo (FCM), aproveitando as autorizações e preferências privadas já existentes. Web Push/VAPID não entrega notificações nativas no APK.
- Produzir um som original e incluí-lo como recurso do Android. Canal de notificação com opções do sistema, controles gerais e silenciamento por conversa dentro do app. Não recriar canais para desfazer uma escolha de silêncio do usuário.
- Permissão explícita no Android 13+, comportamento com app aberto/fechado, bateria, toque no aviso, sessão encerrada e dispositivo desassociado. Aviso genérico sem texto privado no push.
- Dependência externa: projeto Firebase/FCM e configuração do servidor, com credenciais administrativas somente no servidor. Só anunciar ativação após entrega real no aparelho.

## 5. Chamadas privadas e em grupo

- WebRTC com áudio/vídeo nos dois clientes, inicialmente P2P: iniciar, tocar, aceitar/recusar, silenciar microfone, ligar/desligar câmera, alternar câmera/saída de áudio, encerrar e reconectar.
- Sinalização autenticada e autorizada pela participação atual na conversa; estado e convites temporários com expiração. Sem acesso de terceiros e sem leitura global por administradores.
- STUN e TURN com credenciais temporárias: P2P também pode precisar de retransmissão TURN em redes móveis/NAT. Não prometer chamadas externas confiáveis com apenas um servidor STUN.
- Grupos em malha P2P; definir e testar o limite simultâneo suportado pelos aparelhos. Os 20 usuários do aplicativo não equivalem a 20 vídeos simultâneos viáveis em todo celular.
- Testar duas contas/aparelhos, Wi-Fi e rede móvel, chamada recusada/perdida, saídas e remoções do grupo, permissões, interrupções e segundo plano. Recursos de chamada em segundo plano precisam seguir as exigências de serviço e notificação do Android.
- Medir perda, latência, bitrate, CPU/bateria e qualidade de grupos. Usar essas medições para decidir a futura adoção de SFU, como solicitado.

## Distribuição

Cada entrega Android mantém pacote e chave de assinatura, incrementa versionCode e oferece APK/checksum no site. Não pedir desinstalação como rotina de atualização. Versionar instruções de configuração, testes e limitações de cada etapa. Não chamar uma etapa de paridade completa enquanto faltarem recursos ou testes físicos correspondentes.
