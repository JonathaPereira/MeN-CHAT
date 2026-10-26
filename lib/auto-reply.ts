export function automatedReply(text: string, hasAttachments: boolean): string {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (hasAttachments)
    return "A prévia do anexo apareceu por aqui! 📎 Este é um teste local: nenhum arquivo foi enviado para a nuvem.";
  if (/\b(oi|olá|ola|bom dia|boa tarde|boa noite)\b/i.test(normalized))
    return "Oi! 👋 Sou o assistente de teste do M&N. Experimente escrever, redimensionar a tela ou anexar uma foto.";
  if (/grupo/i.test(normalized))
    return "Para testar um grupo, clique no ícone de criar grupo, escolha um nome e os participantes fictícios. Eu também respondo por lá. 💬";
  if (/escuro|tema/i.test(normalized))
    return "O modo escuro está no botão de lua. A preferência continua ao navegar entre login, perfil e conversas. 🌙";
  if (/foto|vídeo|video|anexo/i.test(normalized))
    return "Use o clipe ao lado da mensagem. Você pode testar fotos, vídeos, áudios e documentos com prévia local. 📎";
  return "Mensagem de teste recebida! 💚 Experimente uma mensagem longa ou diminua a janela para conferir os balões. Esta resposta é automática e fica só neste navegador.";
}
