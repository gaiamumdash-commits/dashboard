"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importarMapa } from "@/lib/ecc/mapas/actions";
import { lerMapaDeArquivoComIA } from "@/lib/ecc/mapas/importar-ia";
import {
  ACEITA_IMPORTACAO,
  TAMANHO_MAXIMO_LEITURA_IA,
  arvoreParaMapa,
  formatoDoArquivo,
  itensParaLinhas,
  lerFreeMind,
  lerMarkdown,
  lerXMindJson,
  lerXMindXml,
  linhasParaItens,
  mudarNivel,
  removerLinha,
  type LinhaPrevia,
  type RamoImportado,
} from "@/lib/ecc/mapas/importar";
import { lerTextoDoZip } from "@/lib/ecc/mapas/zip";
import { MAX_NOS_POR_MAPA, MAX_TEXTO_NO, type CorRamo } from "@/lib/ecc/mapas/tipos";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_BOTAO_SECUNDARIO, CLASSE_CAMPO } from "@/components/planner/estilos";

const LADO_MAXIMO_FOTO = 2048;
/** Arquivos lidos no navegador (XMind, .mm, Markdown) — bem acima de um
 * mapa de 500 ramos; só barra arquivo que não é mapa. */
const TAMANHO_MAXIMO_ESTRUTURADO = 20 * 1024 * 1024;

/** Foto reduzida pra caber no limite de envio (e a IA lê igual). Se o
 * navegador não conseguir abrir a imagem (HEIC fora do Safari), manda a
 * original quando ela já cabe. */
async function fotoParaEnvio(arquivo: File): Promise<Blob> {
  try {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(imagem.width, imagem.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagem.width * escala);
    canvas.height = Math.round(imagem.height * escala);
    canvas.getContext("2d")?.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    imagem.close();
    const reduzida = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (reduzida && reduzida.size <= TAMANHO_MAXIMO_LEITURA_IA) return reduzida;
  } catch {
    // segue pra tentativa com o arquivo original
  }
  if (arquivo.size <= TAMANHO_MAXIMO_LEITURA_IA) return arquivo;
  throw new Error("Não consegui abrir essa foto. Tente salvar como JPG ou PNG e importar de novo.");
}

/** Arquivo escolhido → árvore do mapa. XMind, .mm e Markdown/TXT são lidos
 * aqui no navegador, sem IA; só foto e PDF vão pro servidor (Gemini). */
async function lerArquivo(arquivo: File): Promise<{ raiz: RamoImportado; incertos: number }> {
  const formato = formatoDoArquivo(arquivo.name, arquivo.type);
  if (formato === "xmind" || formato === "freemind" || formato === "markdown") {
    if (arquivo.size > TAMANHO_MAXIMO_ESTRUTURADO) throw new Error("Arquivo grande demais para importar (máximo 20 MB).");
  }
  switch (formato) {
    case "xmind": {
      const conteudo = await lerTextoDoZip(await arquivo.arrayBuffer(), ["content.json", "content.xml"]);
      if (!conteudo) throw new Error("Esse arquivo não parece ser do XMind.");
      const raiz = conteudo.nome === "content.json" ? lerXMindJson(conteudo.texto, arquivo.name) : lerXMindXml(conteudo.texto, arquivo.name);
      return { raiz, incertos: 0 };
    }
    case "freemind":
      return { raiz: lerFreeMind(await arquivo.text(), arquivo.name), incertos: 0 };
    case "markdown":
      return { raiz: lerMarkdown(await arquivo.text(), arquivo.name), incertos: 0 };
    case "imagem":
    case "pdf": {
      if (formato === "pdf" && arquivo.size > TAMANHO_MAXIMO_LEITURA_IA) {
        throw new Error("PDF grande demais — envie até 4 MB (ou só a página do mapa).");
      }
      const envio = formato === "pdf" ? arquivo : await fotoParaEnvio(arquivo);
      const fd = new FormData();
      fd.append("arquivo", envio, arquivo.name);
      const lido = await lerMapaDeArquivoComIA(fd);
      if (lido.erro !== null) throw new Error(lido.erro);
      return { raiz: lido.raiz, incertos: lido.incertos };
    }
    default:
      throw new Error("Formato não suportado. Use .xmind, .mm, .md, .txt, PDF ou foto.");
  }
}

/** Mesmas cores do editor (editor-mapa.tsx, ordem de CORES_RAMO). */
const COR_PREVIA: Record<CorRamo, string> = {
  roxo: "var(--gaiamum-tag-purple)",
  "verde-agua": "var(--gaiamum-tag-teal)",
  coral: "var(--gaiamum-tag-coral)",
  azul: "var(--gaiamum-tag-blue)",
  amarelo: "var(--gaiamum-tag-yellow)",
  lima: "var(--gaiamum-tag-lime)",
  verde: "var(--gaiamum-success)",
  laranja: "var(--gaiamum-warning)",
};

const CLASSE_ICONE = "rounded px-1.5 py-0.5 text-gaiamum-text-muted hover:bg-gaiamum-surface hover:text-gaiamum-text disabled:opacity-30";

/** Diálogo "Importar mapa": escolhe o arquivo, revisa a prévia (corrige
 * textos, níveis, exclui ramos) e só então cria um mapa novo — que abre na
 * hora, editável como qualquer outro. Nada é gravado antes de "Criar mapa". */
export function FormularioImportarMapa({ aoSalvar }: { aoSalvar: () => void }) {
  const router = useRouter();
  const { pendente, executar } = useAcaoPlanner();
  const [lendo, setLendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaPrevia[] | null>(null);
  const [titulo, setTitulo] = useState("");
  const [notaCentral, setNotaCentral] = useState<string | null>(null);
  const [cortados, setCortados] = useState(0);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setLinhas(null);
    const formato = formatoDoArquivo(arquivo.name, arquivo.type);
    setLendo(formato === "imagem" || formato === "pdf" ? "Lendo o mapa com IA... (pode levar uns segundos)" : "Lendo o arquivo...");
    try {
      const { raiz } = await lerArquivo(arquivo);
      const mapa = arvoreParaMapa(raiz);
      if (mapa.itens.length === 0) throw new Error("Achei só a ideia central, sem nenhum ramo. Confira o arquivo.");
      setLinhas(itensParaLinhas(mapa.itens));
      setTitulo(mapa.titulo);
      setNotaCentral(mapa.notaCentral);
      setCortados(mapa.cortados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler esse arquivo.");
    } finally {
      setLendo(null);
    }
  }

  function criar() {
    if (!linhas) return;
    if (linhas.some((l) => !l.texto.trim())) {
      setErro("Há ramos sem texto. Escreva algo ou exclua esses ramos.");
      return;
    }
    setErro(null);
    executar(
      async () => {
        const r = await importarMapa({ titulo, notaCentral, itens: linhasParaItens(linhas) });
        if (r.ok && r.id) router.push(`/mapas/${r.id}`);
        return r;
      },
      { sucesso: "Mapa importado. Já pode editar.", aoConcluir: aoSalvar },
    );
  }

  const editar = (i: number, texto: string) =>
    setLinhas((atual) => atual && atual.map((l, j) => (j === i ? { ...l, texto, incerto: false } : l)));
  const incertos = linhas?.filter((l) => l.incerto).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Arquivo do mapa
        <input
          type="file"
          accept={ACEITA_IMPORTACAO}
          disabled={!!lendo || pendente}
          onChange={(e) => {
            void escolher(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="text-sm text-gaiamum-text file:mr-3 file:rounded-lg file:border-0 file:bg-gaiamum-primary/15 file:px-3 file:py-2 file:text-gaiamum-text"
        />
        <span className="text-xs">
          XMind (.xmind), MindMeister/FreeMind (.mm), Markdown ou texto (.md, .txt) — ou uma foto/PDF do mapa, que a IA lê.
        </span>
      </label>

      {lendo && <p className="text-sm text-gaiamum-text-muted">{lendo}</p>}
      {erro && <p className="text-sm text-gaiamum-danger">{erro}</p>}

      {linhas && (
        <>
          <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            Ideia central
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={MAX_TEXTO_NO} className={CLASSE_CAMPO} />
          </label>
          <div className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            <span>
              Confira antes de criar: {linhas.length} {linhas.length === 1 ? "ramo" : "ramos"}
              {linhas.some((l) => l.nota) && " · 📝 com notas"}
              {linhas.some((l) => l.cor) && " · cores do original"}
              {linhas.some((l) => l.nivel === 0 && l.lado) &&
                (linhas.every((l) => l.nivel > 0 || (l.lado ?? 1) === 1)
                  ? " · ramos à direita, como no original"
                  : " · lados como no original")}
            </span>
            {incertos > 0 && (
              <span className="text-gaiamum-warning">
                ⚠️ {incertos} {incertos === 1 ? "ramo ficou" : "ramos ficaram"} com leitura incerta — confira o texto e o lugar.
              </span>
            )}
            <ul className="max-h-72 overflow-y-auto rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised p-2 text-xs text-gaiamum-text">
              {linhas.map((linha, i) => (
                <li key={i} style={{ paddingLeft: `${linha.nivel * 14}px` }} className="flex items-center gap-1 py-0.5">
                  <span
                    aria-hidden
                    className="w-3 shrink-0 text-gaiamum-text-muted"
                    style={linha.cor && !linha.incerto ? { color: COR_PREVIA[linha.cor] } : undefined}
                  >
                    {linha.incerto ? "⚠️" : linha.cor || linha.nivel === 0 ? "●" : "–"}
                  </span>
                  <input
                    value={linha.texto}
                    onChange={(e) => editar(i, e.target.value)}
                    maxLength={MAX_TEXTO_NO}
                    aria-label={`Texto do ramo ${i + 1}`}
                    className={`min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 outline-none focus:bg-gaiamum-surface ${linha.incerto ? "text-gaiamum-warning" : ""}`}
                  />
                  {linha.nota && <span title={linha.nota}>📝</span>}
                  <button type="button" title="Subir um nível" aria-label="Subir um nível" disabled={linha.nivel === 0} onClick={() => setLinhas(mudarNivel(linhas, i, -1))} className={CLASSE_ICONE}>
                    ←
                  </button>
                  <button type="button" title="Virar sub-ramo do de cima" aria-label="Virar sub-ramo do de cima" disabled={mudarNivel(linhas, i, 1) === linhas} onClick={() => setLinhas(mudarNivel(linhas, i, 1))} className={CLASSE_ICONE}>
                    →
                  </button>
                  <button type="button" title="Excluir (com o que está dentro)" aria-label="Excluir ramo" onClick={() => setLinhas(removerLinha(linhas, i))} className={`${CLASSE_ICONE} hover:text-gaiamum-danger`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {cortados > 0 && (
              <span className="text-gaiamum-danger">
                {cortados} ramos ficaram de fora pelo limite de {MAX_NOS_POR_MAPA} ramos por mapa.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={criar} disabled={pendente || !titulo.trim() || linhas.length === 0} className={CLASSE_BOTAO_PRIMARIO}>
              {pendente ? "Criando..." : "Criar mapa"}
            </button>
            <button type="button" onClick={() => setLinhas(null)} disabled={pendente} className={CLASSE_BOTAO_SECUNDARIO}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
