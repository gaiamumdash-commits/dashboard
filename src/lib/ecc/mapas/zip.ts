// Leitor mínimo de .zip pra abrir o .xmind no navegador — sem biblioteca:
// lê o diretório central e descompacta com `DecompressionStream`
// ("deflate-raw"), nativo nos navegadores atuais e no Node 18+. Só o que o
// XMind usa: arquivos guardados (método 0) ou deflate (método 8).

const ASSINATURA_FIM = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_LOCAL = 0x04034b50;

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** Conteúdo (texto UTF-8) do primeiro arquivo do zip cujo nome está em
 * `nomes` (na ordem de preferência), ou null se nenhum existir. */
export async function lerTextoDoZip(zip: ArrayBuffer, nomes: string[]): Promise<{ nome: string; texto: string } | null> {
  const bytes = new Uint8Array(zip);
  const visao = new DataView(zip);

  // O registro "fim do diretório central" fica nos últimos 22 bytes + até
  // 64 KB de comentário.
  let fim = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (visao.getUint32(i, true) === ASSINATURA_FIM) {
      fim = i;
      break;
    }
  }
  if (fim === -1) throw new Error("Esse arquivo não é um .xmind válido.");

  const total = visao.getUint16(fim + 10, true);
  let posicao = visao.getUint32(fim + 16, true);
  const encontrados = new Map<string, { metodo: number; tamanho: number; local: number }>();
  const decodificador = new TextDecoder();

  for (let i = 0; i < total && posicao + 46 <= bytes.length; i++) {
    if (visao.getUint32(posicao, true) !== ASSINATURA_CENTRAL) break;
    const metodo = visao.getUint16(posicao + 10, true);
    const tamanho = visao.getUint32(posicao + 20, true);
    const tamanhoNome = visao.getUint16(posicao + 28, true);
    const tamanhoExtra = visao.getUint16(posicao + 30, true);
    const tamanhoComentario = visao.getUint16(posicao + 32, true);
    const local = visao.getUint32(posicao + 42, true);
    const nome = decodificador.decode(bytes.subarray(posicao + 46, posicao + 46 + tamanhoNome));
    encontrados.set(nome, { metodo, tamanho, local });
    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }

  for (const nome of nomes) {
    const entrada = encontrados.get(nome);
    if (!entrada) continue;
    if (visao.getUint32(entrada.local, true) !== ASSINATURA_LOCAL) throw new Error("Esse arquivo .xmind está corrompido.");
    const inicio = entrada.local + 30 + visao.getUint16(entrada.local + 26, true) + visao.getUint16(entrada.local + 28, true);
    const comprimido = bytes.subarray(inicio, inicio + entrada.tamanho);
    let conteudo: Uint8Array;
    if (entrada.metodo === 0) conteudo = comprimido;
    else if (entrada.metodo === 8) conteudo = await inflar(comprimido);
    else throw new Error("Esse .xmind usa uma compressão que o Gaiamum não lê.");
    return { nome, texto: decodificador.decode(conteudo) };
  }
  return null;
}
