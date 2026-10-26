# Anexos e armazenamento

Consulta à documentação oficial em 26/10/2026. Esta etapa usa somente `File`, URLs `blob:` e prévias no navegador. Não há upload, conta Cloudflare, bucket, cobrança ou integração com Supabase Storage. A escolha do armazenamento continua pendente; Supabase Storage permanece a opção da stack original, e R2 é uma alternativa a avaliar.

## Política inicial do aplicativo

Os limites abaixo são escolhas do M&N CHAT para os testes, não limites anunciados dos provedores. MB significa 1.000.000 bytes.

| Categoria      | Formatos aceitos                    | Limite por arquivo                       |
| -------------- | ----------------------------------- | ---------------------------------------- |
| Foto de perfil | JPG, PNG, WebP                      | 2 MB; reduzida para até 256 × 256 pixels |
| Fotos no chat  | JPG, PNG, WebP, GIF                 | 5 MB                                     |
| Vídeos         | MP4, WebM, MOV                      | 25 MB                                    |
| Áudios         | MP3, M4A, OGG, WAV, WebM            | 10 MB                                    |
| Documentos     | PDF, TXT, ZIP, DOC, DOCX, XLS, XLSX | 10 MB                                    |

Até 5 arquivos por mensagem. Formatos executáveis e páginas HTML/SVG não são aceitos. A lista de formatos permite anexar; a reprodução de mídia depende dos codecs do navegador. Vídeos não são convertidos ou comprimidos. A validação atual de MIME e extensão é apenas uma proteção de interface, não uma garantia de segurança do conteúdo.

## Cloudflare: limites diferentes para serviços diferentes

- **Workers e requisições HTTP:** o tamanho máximo do corpo de uma requisição depende do plano Cloudflare da conta. A documentação consultada informa 100 MB nos planos Free/Pro e 200 MB no Business. O corpo multipart inclui bytes adicionais além do arquivo. Não confundir esse limite com armazenamento.
- **Arquivos estáticos do Workers:** o limite documentado por arquivo é 25 MiB. Isso se refere aos arquivos da aplicação publicados, não a um serviço de armazenamento de anexos.
- **R2:** a API de objetos documenta upload de uma parte de até 5 GiB, com valor exato de 4,995 GiB, e upload multipart para objetos maiores, sujeito a outros limites. Esse teto não substitui o limite da rota HTTP pela qual o arquivo passar.
- **Franquia R2 Standard:** a documentação consultada inclui 10 GB-mês de armazenamento, 1 milhão de operações Classe A e 10 milhões Classe B por mês. Há custos ao exceder a franquia. Egress sem cobrança não significa armazenamento e operações ilimitados ou gratuitos.

A infraestrutura ainda não está provisionada. Não há evidência de qual plano, quota de conta, região ou limite de bucket será utilizado. Valores e planos devem ser conferidos novamente na integração.

## Antes de liberar para pessoas reais

1. Escolher Supabase Storage ou R2 e definir orçamento, quotas por pessoa/grupo e retenção.
2. Usar bucket privado. Autorizar upload e download conforme sessão e participação na conversa; URLs assinadas devem expirar.
3. Validar tamanho, formato e conteúdo no servidor e no provedor; não confiar em `Content-Type` ou extensão fornecidos pelo navegador. Tratar ZIPs e arquivos do Office como conteúdo não confiável e servir downloads com headers adequados.
4. Definir limites de mensagens e uploads, prevenção de abuso e exclusão de arquivos órfãos. Códigos de seis caracteres são identificadores públicos; buscas reais exigem autorização e limitação de tentativas.
5. Avaliar upload direto assinado, sem expor chaves administrativas e sem tornar o bucket público. Nunca enviar credenciais de Cloudflare/R2 no JavaScript do cliente.
6. Testar upload, reprodução, falhas, cancelamento e autorização real. Os testes atuais não validam infraestrutura.

## Fontes oficiais

- [Workers — limites](https://developers.cloudflare.com/workers/platform/limits/)
- [R2 — limites](https://developers.cloudflare.com/r2/platform/limits/)
- [R2 — preços e franquias](https://developers.cloudflare.com/r2/pricing/)
- Fontes consultadas: os arquivos correspondentes em [`cloudflare/cloudflare-docs`](https://github.com/cloudflare/cloudflare-docs/tree/production/src/content/docs), mantidos pela Cloudflare.
