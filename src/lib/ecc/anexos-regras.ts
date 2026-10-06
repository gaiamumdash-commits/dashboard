/**
 * Tipos de arquivo aceitos como anexo (auditoria de segurança 2026-10-06).
 * Antes qualquer arquivo era aceito e o Content-Type vinha do navegador —
 * um .html/.svg com script podia ser guardado e aberto pelo link assinado.
 * Agora: só extensões da lista, e o Content-Type sai DAQUI (pela extensão),
 * nunca do que o navegador declarou. Lógica pura, testável.
 */
const TIPOS_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
};

/** Valor do atributo `accept` do <input type="file"> — o seletor de arquivo
 * já esconde o que não é aceito (o servidor revalida de qualquer jeito). */
export const ACCEPT_ANEXOS = Object.keys(TIPOS_POR_EXTENSAO)
  .map((ext) => `.${ext}`)
  .join(",");

export const MENSAGEM_TIPO_NAO_ACEITO =
  "Tipo de arquivo não aceito. Envie PDF, imagem (JPG, PNG, WEBP, HEIC), documento do Office/LibreOffice, TXT ou CSV.";

/** Content-Type seguro pro arquivo, ou `null` se a extensão não é aceita. */
export function contentTypeDoAnexo(nomeArquivo: string): string | null {
  const partes = nomeArquivo.toLowerCase().trim().split(".");
  if (partes.length < 2) return null;
  return TIPOS_POR_EXTENSAO[partes[partes.length - 1]] ?? null;
}
