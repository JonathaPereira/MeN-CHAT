export function chatError(
  error:
    | { message?: string; code?: string; statusCode?: string | number }
    | null
    | undefined,
  fallback = "Não foi possível concluir. Tente novamente.",
): string {
  const message = error?.message || "";
  if (/500 MB|aplicativo cheio/.test(message))
    return "O armazenamento do MenChat está cheio. Novos anexos estão temporariamente bloqueados. Avise o administrador.";
  if (/100 MB|Limite diário/.test(message))
    return "Você atingiu 100 MB de envios nas últimas 24 horas. Aguarde para enviar novos anexos.";
  if (/pendentes/.test(message))
    return "Conclua ou descarte seus anexos pendentes antes de enviar outro.";
  if (/exceed_storage_size_quota|storage.*quota|quota.*storage/i.test(message))
    return "O armazenamento do provedor está limitado. Avise o administrador para verificar a franquia.";
  if (String(error?.statusCode) === "402" || error?.code === "402")
    return "O serviço está temporariamente limitado pelo provedor. Avise o administrador.";
  if (/23514/.test(error?.code || ""))
    return "Confira o formato e o tamanho do arquivo. Fotos: 5 MB; vídeos: 25 MB; áudios e documentos: 10 MB.";
  if (/42501/.test(error?.code || "") || String(error?.statusCode) === "403")
    return "Você não tem permissão para esta ação. Atualize a conversa ou entre novamente.";
  return fallback;
}
