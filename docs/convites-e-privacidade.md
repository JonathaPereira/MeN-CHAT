# Convites, códigos e privacidade do MenChat

## O que esta versão faz

É uma demonstração local, sem autenticação, contas de outras pessoas ou autorização no servidor. Os contatos, as leituras e a digitação são fictícios. As mensagens ficam separadas por conversa na memória da aba, e as opções de privacidade alteram a interface. Isso não constitui proteção de dados reais: os dados fictícios fazem parte do JavaScript enviado ao navegador.

- Clicar no nome de um contato abre o perfil; clicar no nome do grupo abre os participantes e seus perfis.
- Cada novo perfil local recebe um código de seis caracteres com letras e números. Os contatos fictícios usam códigos fixos para permitir testes repetíveis.
- É possível ocultar o código na prévia pública do próprio perfil. O proprietário continua vendo seu código no editor.
- Exibição do código e permissão de busca são independentes: ocultar o código no perfil não impede que alguém que já o conhece faça uma busca, enquanto a busca estiver permitida.
- A busca respeita a privacidade dos contatos fictícios. Lucas oculta o código no perfil e ainda permite busca; Júlia não permite busca por código. No próprio código, a busca mostra uma prévia do seu perfil ou não o encontra, conforme sua preferência.
- “Quem viu” aparece nas mensagens enviadas. Em grupos, lista apenas os participantes e preserva a opção de não compartilhar leitura. “Sem confirmação” não significa que alguém não leu.
- Indicadores de digitação exibem nome e avatar de participantes da conversa, sempre marcados como simulação. Podem ser desativados em Configurações → Privacidade.

O código AMIGOS20 continua sendo apenas o roteiro de cadastro fictício da demonstração. Não é um convite real de uso único. Nenhum mecanismo de segurança deve depender dele.

## Convite de uso único: modelo para a integração real

Um link de uso único, sozinho, pode ser repassado antes do primeiro uso. Vincular o convite a um e-mail também não basta se o próprio link já funcionar como prova de acesso ao e-mail ou como sessão autenticada. O fluxo proposto exige uma verificação independente na aceitação:

1. O administrador informa o e-mail da pessoa e cria um convite com validade, estado e token aleatório forte. O token público de convite não é o código de usuário de seis caracteres e não concede uma sessão autenticada.
2. O servidor mantém somente o hash do token, o e-mail destinatário, expiração, revogação e consumo. A pessoa não pode alterar o e-mail vinculado ao convite.
3. Ao abrir o convite, a pessoa solicita uma **nova verificação por e-mail**, enviada naquele momento ao endereço vinculado. O OTP/código de verificação não pode estar embutido no link que o convidado pode encaminhar.
4. Somente uma identidade com esse e-mail confirmado pode concluir a aceitação. Uma sessão para uma conta pendente não deve permitir acesso ao chat.
5. O servidor valida convite, identidade, limite de 20 membros e expiração e consome o convite de forma atômica, criando/ativando o perfil uma única vez. Duas tentativas simultâneas não podem ativar duas contas.
6. O administrador pode revogar um convite ainda não utilizado. Convites usados ou expirados devem falhar mesmo após recarregar, trocar de navegador ou aparelho.

Assim, repassar apenas o link não é suficiente para aceitar. Compartilhar também o acesso ao e-mail, OTP ou credenciais continua sendo uma ação possível do titular; não é correto prometer que o aplicativo elimina todo compartilhamento deliberado de contas.

A implementação ficará no servidor, com Supabase Auth e persistência no PostgreSQL. Cadastro público permanecerá desativado. Segredos administrativos nunca irão para o navegador, arquivos públicos, logs ou repositório. Não é necessário fornecer credenciais para testar esta etapa visual.

## Códigos de usuário reais

O servidor deverá gerar o código automaticamente, com aleatoriedade adequada, índice único e nova tentativa em caso de colisão. São seis caracteres alfanuméricos e um identificador público, nunca uma senha, convite ou token de acesso.

A busca será limitada a membros convidados autenticados, com limitação de tentativas e respeito à permissão de descoberta. Respostas de busca não devem revelar dados de perfis indisponíveis. Ocultar um código no perfil exige omitir esse valor da resposta da API para outros usuários; escondê-lo por CSS não protege o dado. O proprietário deve manter acesso ao próprio código.

Encontrar um perfil não dá acesso ao histórico de outra conversa. Uma nova conversa privada terá apenas os dois participantes.

## Mensagens, grupos, leitura e digitação reais

- Conversas privadas: somente seus dois participantes podem consultar e inserir mensagens naquela conversa. A API e as políticas RLS devem impor isso, inclusive em requisições diretas fora da interface.
- Grupos: mensagens visíveis aos membros autorizados daquele grupo, não a todos os usuários do aplicativo. Histórico de entrada/saída e revogação de acesso precisarão de uma política explícita antes da liberação.
- Anexos: bucket privado e URLs assinadas apenas para membros autorizados, seguindo a mesma regra da conversa. Um código de usuário nunca autoriza o download de uma mídia.
- Confirmações: cada conta só registra sua própria leitura, para mensagens de uma conversa a que pertence. A API deve respeitar a opção de privacidade e não retornar eventos ocultos a outros usuários.
- Digitação: eventos efêmeros, com tempo de expiração, vinculados à identidade autenticada e ao canal privado da conversa. Não transmitir para canais globais nem aceitar identidades arbitrárias enviadas pelo cliente.
- Realtime e presença: autorização por participação, inclusive após remoção de um grupo; sem assinar uma tabela global de mensagens para depois filtrar somente no cliente.

Antes de convidar pessoas reais, a integração deverá testar e-mail diferente, link repassado, OTP incorreto, expiração, revogação, consumo concorrente, colisões de código, buscas desativadas e tentativas de ler mensagens/anexos de outros grupos por API. Esses cenários de infraestrutura ainda não foram implementados ou validados.

## Administração de grupos

Na demonstração, o criador tem identidade imutável, o dono tem a propriedade atual e a lista de administradores é separada. Criar um grupo dá ao usuário os três atributos. Transferir propriedade preserva o criador e mantém o antigo dono como administrador até sua saída voluntária.

O criador original jamais pode ser removido ou rebaixado por outro participante, inclusive pelo dono seguinte. O dono atual também não pode ser removido por outros administradores. Para sair com outros membros presentes, o dono precisa primeiro transferir a propriedade a um participante existente. Se for o último membro, sua saída encerra a propriedade; o histórico local permanece apenas para consulta.

Administradores podem adicionar pelo código de um perfil fictício já cadastrado e promover membros. Só o dono revoga administradores ou remove outro administrador. Os demais administradores removem apenas membros comuns. Todos os caminhos verificam participação atual, duplicatas e limite de 20 pessoas. Quem saiu não administra ou envia mensagens; respostas automáticas pendentes são canceladas.

Antes da liberação real, `creator_id` deverá ser imutável no banco. As operações de associação, remoção, promoção, transferência e saída devem validar a identidade autenticada no servidor e manter atomicamente um dono ativo enquanto houver membros. Uma remoção administrativa nunca poderá atingir o criador; sua saída precisa ser uma ação autenticada dele próprio. APIs de exclusão e atualizações diretas não podem contornar essas invariantes. A unicidade de associação e o limite de membros também precisam ser garantidos em transação.

Adicionar por código ao grupo e convidar alguém para o aplicativo são fluxos diferentes. O administrador do grupo só poderá adicionar pessoas que já têm uma conta convidada e ativa, respeitando a privacidade de busca. Isso não substitui o convite de cadastro vinculado ao e-mail, de uso único e com verificação independente.
