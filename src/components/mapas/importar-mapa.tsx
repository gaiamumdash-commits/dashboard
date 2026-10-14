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
  lerFreeMind,
  lerMarkdown,
  lerXMindJson,
  lerXMindXml,
  type MapaImportado,
  type RamoImportado,
} from "@/lib/ecc/mapas/importar";
import { lerTextoDoZip } from "@/lib/ecc/mapas/zip";
import { MAX_NOS_POR_MAPA, MAX_TEXTO_NO } from "@/lib/ecc/mapas/tipos";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_BOTAO_SECUNDARIO, CLASSE_CAMPO } from "@/components/planner/estilos";

const LADO_MAXIMO_FOTO = 2048;

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

/** Arquivo escolhido → árvore do mapa. XMind, .mm e Markdown são lidos
 * aqui no navegador; foto e PDF vão pra IA (Gemini) no servidor. */
async function lerArquivo(arquivo: File): Promise<RamoImportado> {
  const formato = formatoDoArquivo(arquivo.name, arquivo.type);
  switch (formato) {
    case "xmind": {
      const conteudo = await lerTextoDoZip(await arquivo.arrayBuffer(), ["content.json", "content.xml"]);
      if (!conteudo) throw new Error("Esse arquivo não parece ser do XMind.");
      return conteudo.nome === "content.json" ? lerXMindJson(conteudo.texto, arquivo.name) : lerXMindXml(conteudo.texto, arquivo.name);
    }
    case "freemind":
      return lerFreeMind(await arquivo.text(), arquivo.name);
    case "markdown":
      return lerMarkdown(await arquivo.text(), arquivo.name);
    case "imagem":
    case "pdf": {
      if (formato === "pdf" && arquivo.size > TAMANHO_MAXIMO_LEITURA_IA) {
        throw new Error("PDF grande demais — envie até 4 MB (ou só a página do mapa).");
      }
      const envio = formato === "pdf" ? arquivo : await fotoParaEnvio(arquivo);
      const fd = new FormData();
      fd.append("arquivo", envio, arquivo.name);
      const { markdown, erro } = await lerMapaDeArquivoComIA(fd);
      if (erro !== null) throw new Error(erro);
      return lerMarkdown(markdown, arquivo.name);
    }
    default:
      throw new Error("Formato não suportado. Use .xmind, .mm, .md, .txt, PDF ou foto.");
  }
}

function niveis(itens: MapaImportado["itens"]): number[] {
  const nivel: number[] = [];
  itens.forEach((item, i) => {
    nivel[i] = item.pai === -1 ? 0 : nivel[item.pai] + 1;
  });
  return nivel;
}

/** Diálogo "Importar mapa": escolhe o arquivo, mostra a prévia dos ramos e
 * cria um mapa novo — que abre na hora, editável como qualquer outro. */
export function FormularioImportarMapa({ aoSalvar }: { aoSalvar: () => void }) {
  const router = useRouter();
  const { pendente, executar } = useAcaoPlanner();
  const [lendo, setLendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mapa, setMapa] = useState<MapaImportado | null>(null);
  const [titulo, setTitulo] = useState("");

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setMapa(null);
    const formato = formatoDoArquivo(arquivo.name, arquivo.type);
    setLendo(formato === "imagem" || formato === "pdf" ? "Lendo o mapa com IA... (pode levar uns segundos)" : "Lendo o arquivo...");
    try {
      const lido = arvoreParaMapa(await lerArquivo(arquivo));
      if (lido.itens.length === 0) throw new Error("Achei só a ideia central, sem nenhum ramo. Confira o arquivo.");
      setMapa(lido);
      setTitulo(lido.titulo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler esse arquivo.");
    } finally {
      setLendo(null);
    }
  }

  function criar() {
    if (!mapa) return;
    executar(
      async () => {
        const r = await importarMapa({ titulo, notaCentral: mapa.notaCentral, itens: mapa.itens });
        if (r.ok && r.id) router.push(`/mapas/${r.id}`);
        return r;
      },
      { sucesso: "Mapa importado. Já pode editar.", aoConcluir: aoSalvar },
    );
  }

  const nivel = mapa ? niveis(mapa.itens) : [];

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

      {mapa && (
        <>
          <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            Ideia central
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={MAX_TEXTO_NO} className={CLASSE_CAMPO} />
          </label>
          <div className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            <span>
              {mapa.itens.length} {mapa.itens.length === 1 ? "ramo" : "ramos"}
              {mapa.itens.some((i) => i.nota) && " · com notas"}
            </span>
            <ul className="max-h-64 overflow-y-auto rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised p-3 text-xs text-gaiamum-text">
              {mapa.itens.map((item, i) => (
                <li key={i} style={{ paddingLeft: `${nivel[i] * 16}px` }} className="truncate py-0.5">
                  {nivel[i] === 0 ? "● " : "– "}
                  {item.texto}
                  {item.nota && <span className="text-gaiamum-text-muted"> 📝</span>}
                </li>
              ))}
            </ul>
            {mapa.cortados > 0 && (
              <span className="text-gaiamum-danger">
                {mapa.cortados} ramos ficaram de fora pelo limite de {MAX_NOS_POR_MAPA} ramos por mapa.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={criar} disabled={pendente || !titulo.trim()} className={CLASSE_BOTAO_PRIMARIO}>
              {pendente ? "Criando..." : "Criar mapa"}
            </button>
            <button type="button" onClick={() => setMapa(null)} disabled={pendente} className={CLASSE_BOTAO_SECUNDARIO}>
              Escolher outro
            </button>
          </div>
        </>
      )}
    </div>
  );
}
