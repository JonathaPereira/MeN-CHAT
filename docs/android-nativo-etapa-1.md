# Android nativo — etapa 1

A entrega atual é a [versão 2.2.0 — câmera, anexos e perfil](android-midia-perfil-2.2.md), sobre a [interface 2.1](android-interface-2.1.md). As seções abaixo também preservam o histórico das entregas 2.0.x.

A partir do APK 2.0.0, o MenChat tem uma interface Android própria em Kotlin e Jetpack Compose, no módulo `android/nativeApp`. Não usa WebView, Trusted Web Activity ou Chrome para abrir o chat. O módulo antigo `android/app` fica preservado como histórico da integração TWA.

## Usar

1. Aguarde o deploy da Vercel ficar Ready: esta entrega publica `/api/mobile/config`, que fornece exclusivamente a URL/chave publicável já usadas pelo site.
2. Baixe `menchat-2.2.0.apk` pelo botão **Baixar app Android** no site ou pelo GitHub.
3. Instale como atualização do MenChat existente. O pacote e a assinatura são os mesmos; o versionCode sobe para 7.
4. Entre com o e-mail e a senha da sua conta já ativada. O login do Chrome não é transferido para o app. Nenhum segredo administrativo deve ser colocado no APK.

Não exige nova migração SQL: usa os contratos existentes, especialmente as migrações 5–7. Não execute comandos de chaves ou SQL novamente para instalar este APK.

## O que foi migrado na primeira etapa (2.0.0)

- Login nativo com verificação remota da identidade e perfil próprio ativo, renovação de sessão, saída e tokens criptografados pelo Android Keystore. Senha não é persistida.
- Lista de privados/grupos, contador de não lidas, busca de uma conversa pelo código do contato e criação de grupo pessoal.
- Texto, respostas e exclusão para mim/todos; regras de autoria e participação continuam no banco.
- Histórico paginado, consulta incremental, sincronização com o app aberto e indicadores reais de leitura/digitação. Não há cache de mensagens para uso offline.
- Gravação AAC/M4A pelo microfone do Android: toque para começar e na seta para enviar. Dois minutos/10 MB, permissão por ação, liberação ao cancelar ou sair. Falha mantém o arquivo local para nova tentativa, com idempotência do envio.
- Reprodução de áudio pelo MediaPlayer Android, prévias de imagens e download de anexos existentes pelo seletor de arquivos do Android, sem encaminhamento automático ao Chrome.
- Tema claro/escuro, identificação da conta/código e controles de áudio à direita.

Reservas incompletas após falha/saída continuam sujeitas à cota e à limpeza administrativa prevista na migração 5. URLs assinadas têm validade de cinco minutos; cópias já baixadas não são recolhidas. Entrada/readmissão em grupo mantém as regras de acesso ao histórico do servidor.

## O que continua na versão web

Primeiro acesso/recuperação de senha e aceite de convite; criação/administração de convites; administração completa de participantes/admins de grupo; favoritos, menções estruturadas e figurinhas. O nativo não substitui ainda esses fluxos da web.

Notificações Android com o app fechado exigem outra etapa, com integração nativa de push, preferencialmente FCM. O Web Push da migração 8 continua pertencendo ao site/Chrome, não se transforma em push nativo apenas pela instalação deste APK. A fila do banco continua recebendo mensagens; o agendador configurado pode entregar aos dispositivos web inscritos. Não há chamadas de voz/vídeo nesta etapa.

A versão web preserva todos os seus recursos. Não há cadastro público nem demonstração disfarçada de conta real. Esta é a primeira entrega da migração nativa em etapas; conferir login, envio, áudio e teclado no Poco antes de ampliar seu uso.

## Compilar e verificar

JDK 21 completo, Android SDK/Build Tools 36.0.0 e assinatura privada já existente. No diretório `android`, execute `./gradlew :nativeApp:testDebugUnitTest :nativeApp:assembleRelease` com as variáveis de assinatura descritas no guia anterior. Saída: `nativeApp/build/outputs/apk/release/nativeApp-release.apk`.

Os testes HTTP usam serviços locais simulados para verificar identidade, envio do token da conta, renovação e envios idempotentes. Robolectric Android 15/16 verifica a inicialização da Activity nativa sem dependência do helper do navegador. Conferir no APK final: pacote `app.menchat.android`, versionCode 7, assinatura anterior, Activity nativa e alinhamento de bibliotecas para páginas de 16 KB. O alias de lançamento antigo aponta para a Activity Kotlin para preservar ícones fixados; não instancia o helper nem o Chrome.

Testes simulados não validam o Supabase hospedado nem substituem câmera/microfone e navegação num Android físico. A próxima etapa deve ser autorizada separadamente; não anunciar paridade completa com a web.

## Validação da entrega 2.0.0

Lint, tipos e build web aprovados; 58 testes Node, 27 testes de navegação e nove testes de interface em desktop/celular/tela de 320 px. Dez testes Android aprovados na entrega 2.0.0: contratos HTTP locais, inicialização nativa e descarte da gravação em Robolectric Android 15/16. APK 2.0.0 release com certificado anterior, versionCode 3, checksum e alinhamento ELF/ZIP de 16 KB verificados. Nenhuma chave administrativa foi incorporada.

O Supabase de produção, o deploy da Vercel e o Poco físico não estão acessíveis neste ambiente; o teste com a conta real após o deploy continua necessário.

## Sincronização — correção 2.0.1

O APK 2.0.0 bloqueava a apresentação do histórico até terminar a consulta dos participantes. Uma falha nessa consulta impedia mostrar as mensagens e virava um aviso genérico de conexão. Na 2.0.1, o histórico autorizado é apresentado primeiro; participantes e confirmações de leitura têm tratamento independente. Uma falha na atualização da lista também não impede consultar a conversa já selecionada.

O aviso identifica a operação (LISTA, HISTORICO, PARTICIPANTES ou LEITURA) e distingue rede, tempo de espera, TLS, sessão, permissão, resposta incompatível e erro do servidor. Códigos HTTP/PostgREST/SQL conhecidos podem aparecer, sem conteúdo da resposta, nomes, mensagens, tokens, URLs ou IDs. O detalhe de diagnóstico não concede acesso: cada consulta continua autenticada e sujeita a RLS. Histórico negado/fora da participação é limpo; falhas atrasadas de outra conversa são descartadas.

Instale a 2.0.1 por cima da 2.0.0. Não há troca de chaves, SQL novo, câmera ou push nativo nesta correção. O usuário confirmou que a conversa abre na web; sem acesso à sessão, aos logs do Supabase de produção ou ao Poco, a causa exata da falha original permanece a confirmar no aparelho. Se persistir, informar somente o aviso/código exibido pela nova versão.

Validação da correção: 24 testes Android aprovados, incluindo seis cenários de sincronização em Android 15/16 (12 execuções) e duas verificações de classificação/privacidade de erros. Os 12 testes de sincronização falharam antes da correção e passaram depois. APK 2.0.1/versionCode 4 compilado em release, com assinatura anterior, checksum e alinhamento ELF/ZIP de 16 KB verificados. A versão aparece na engrenagem da conta para conferir a atualização instalada.

Também aprovados nesta correção: lint, tipos e build web, 58 testes Node, 27 testes de navegação e três testes de instalação em desktop/celular/320 px. Não há nova validação de produção ou do Poco físico; a conferência final depende da atualização no aparelho.

## Histórico HTTP 400 e áudio web — correção 2.0.2

A causa concreta encontrada no cliente nativo é o filtro de conferência de visibilidade: ele enviava `id=in(...)`, mas o protocolo PostgREST exige `id=in.(...)`. Essa consulta é executada após buscar o histórico e antes de apresentá-lo. A biblioteca Supabase da web já usa a sintaxe correta. O filtro foi corrigido sem mudar SQL, RLS ou chaves.

O novo teste confere a consulta HTTP efetiva com um servidor local que rejeita a sintaxe inválida com HTTP 400/PGRST100. Falhou antes da correção e passou depois; verifica também remoção de mensagens ocultadas e tombstones sem anexos/citação para mensagens apagadas. A suíte Android completa tem 25 testes. O APK usa versionCode 5 e a mesma assinatura.

Na web, o tempo total do áudio passa a ser conferido nas amostras decodificadas ao começar a ouvir, com leitura adicional limitada a 10 MB. Até a verificação, não há total estimado pelo cabeçalho. Reprodução continua se a conferência não puder ser feita; polling não repete o download. Uma fixture contém dois segundos de som e um cabeçalho de 600 segundos, permitindo testar o erro real sem depender de dados particulares.

Instale a 2.0.2 por cima da versão anterior e teste o mesmo privado/grupo. Para a correção web, recarregue o site após o deploy. O reboot visual, câmera, edição de perfil, som/push nativo e chamadas estão no [roteiro de paridade](roteiro-paridade-android.md); não fazem parte desta primeira entrega de estabilidade.

Verificações da 2.0.2: 25 testes Android aprovados e assinatura/versão/alinhamento ELF e ZIP de 16 KB conferidos; regressão do áudio aprovada em desktop, celular e 320 px (incluindo busca, fim e repetição). Testes simulados complementam, mas não substituem, a confirmação no Poco com a conversa hospedada.

Também aprovados: lint, tipos, build, 58 testes Node, 27 testes de navegação e os testes de instalação, gravação e mídia usuais nos três tamanhos de tela. Nenhuma migração foi alterada e nenhum segredo foi adicionado.
