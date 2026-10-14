import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import {
  arvoreParaMapa,
  decodificarEntidades,
  formatoDoArquivo,
  lerFreeMind,
  lerMarkdown,
  lerXMindJson,
  lerXMindXml,
  recolhidosIniciais,
  type RamoImportado,
} from "@/lib/ecc/mapas/importar";
import { lerTextoDoZip, MAX_DESCOMPACTADO_ZIP } from "@/lib/ecc/mapas/zip";
import { MAX_NOS_POR_MAPA } from "@/lib/ecc/mapas/tipos";

/** Árvore → "texto(filho,filho)" pra comparar estrutura de um jeito legível. */
function forma(r: RamoImportado): string {
  return r.filhos.length ? `${r.texto}(${r.filhos.map(forma).join(",")})` : r.texto;
}

describe("lerFreeMind (.mm)", () => {
  it("lê a hierarquia, entidades, nó autofechado, texto em richcontent e notas", () => {
    const xml = `<map version="1.0.1">
      <node TEXT="Projeto &amp; Metas">
        <node TEXT="Marketing">
          <node TEXT="Anúncios"/>
          <node TEXT="Copy &#233;pica"></node>
        </node>
        <node>
          <richcontent TYPE="NODE"><html><body><p>Equipe <b>forte</b></p></body></html></richcontent>
          <richcontent TYPE="NOTE"><html><body><p>Contratar 2 pessoas</p></body></html></richcontent>
        </node>
      </node>
    </map>`;
    const raiz = lerFreeMind(xml);
    expect(raiz.texto).toBe("Projeto & Metas");
    expect(forma(raiz.filhos[0])).toBe("Marketing(Anúncios,Copy épica)");
    expect(raiz.filhos).toHaveLength(2);
    expect(raiz.filhos[1].texto.replace(/\s+/g, " ").trim()).toBe("Equipe forte");
    expect(raiz.filhos[1].nota?.replace(/\s+/g, " ").trim()).toBe("Contratar 2 pessoas");
  });

  it("arquivo sem nós dá erro claro", () => {
    expect(() => lerFreeMind("<map></map>")).toThrow(/nenhum ramo/);
  });

  it("POSITION dos ramos principais vira o lado (só no 1º nível)", () => {
    const raiz = lerFreeMind(`<map><node TEXT="C"><node TEXT="E" POSITION="left"><node TEXT="E1" POSITION="right"/></node><node TEXT="D" POSITION="right"/></node></map>`);
    expect(raiz.filhos.map((f) => f.lado)).toEqual([-1, 1]);
    expect(raiz.filhos[0].filhos[0].lado).toBeUndefined();
  });
});

describe("lerXMindJson (XMind 2020+)", () => {
  const conteudo = JSON.stringify([
    {
      rootTopic: {
        title: "Viagem",
        notes: { plain: { content: "Julho" } },
        children: {
          attached: [
            { title: "Roteiro", children: { attached: [{ title: "Lisboa" }, { title: "Porto" }] } },
            { title: "Orçamento" },
          ],
          detached: [{ title: "Ideia solta" }],
        },
      },
    },
  ]);

  it("lê tópicos, filhos soltos (detached) e notas", () => {
    const raiz = lerXMindJson(conteudo);
    expect(forma(raiz)).toBe("Viagem(Roteiro(Lisboa,Porto),Orçamento,Ideia solta)");
    expect(raiz.nota).toBe("Julho");
  });

  it("várias abas viram ramos de uma ideia central com o nome do arquivo", () => {
    const duas = JSON.stringify([{ rootTopic: { title: "A" } }, { rootTopic: { title: "B" } }]);
    expect(forma(lerXMindJson(duas, "Planejamento 2027.xmind"))).toBe("Planejamento 2027(A,B)");
  });

  it("mapa lógico para a direita: todos os ramos principais à direita", () => {
    const json = JSON.stringify([
      { rootTopic: { title: "C", structureClass: "org.xmind.ui.logic.right", children: { attached: [{ title: "A" }, { title: "B" }] } } },
    ]);
    expect(lerXMindJson(json).filhos.map((f) => f.lado)).toEqual([1, 1]);
  });

  it("JSON inválido dá erro claro", () => {
    expect(() => lerXMindJson("{oops")).toThrow(/corrompido/);
  });
});

describe("lerXMindXml (XMind 8)", () => {
  it("lê tópicos aninhados e a nota em <notes><plain>", () => {
    const xml = `<xmap-content><sheet><topic id="1"><title>TCC</title>
      <children><topics type="attached">
        <topic id="2"><title>Capítulo 1</title><notes><plain>Revisar com orientador</plain></notes></topic>
        <topic id="3"><title>Capítulo 2</title><children><topics type="attached"><topic id="4"><title>Dados</title></topic></topics></children></topic>
      </topics></children></topic></sheet></xmap-content>`;
    const raiz = lerXMindXml(xml);
    expect(forma(raiz)).toBe("TCC(Capítulo 1,Capítulo 2(Dados))");
    expect(raiz.filhos[0].nota).toBe("Revisar com orientador");
  });
});

describe("lerMarkdown", () => {
  it("títulos viram níveis e listas entram dentro do título de cima", () => {
    const md = "# Lançamento\n\n## Copy\n- Headline\n  - Variação **A**\n- [Anúncios](https://x.com)\n## Orçamento\n1. Mídia\n";
    expect(forma(lerMarkdown(md))).toBe("Lançamento(Copy(Headline(Variação A),Anúncios),Orçamento(Mídia))");
  });

  it("lista com recuo sem título: várias linhas no topo ficam sob o nome do arquivo", () => {
    expect(forma(lerMarkdown("Copy\n  Headline\nEquipe\n", "Ideias.txt"))).toBe("Ideias(Copy(Headline),Equipe)");
  });

  it("ignora bloco de código e linha separadora", () => {
    expect(forma(lerMarkdown("# A\n```\n# não é título\n```\n---\n- B"))).toBe("A(B)");
  });

  it("arquivo vazio dá erro claro", () => {
    expect(() => lerMarkdown("\n \n")).toThrow(/vazio/);
  });
});

describe("arvoreParaMapa", () => {
  it("achata com pai sempre antes do filho e leva as notas", () => {
    const m = arvoreParaMapa(lerMarkdown("# Raiz\n- A\n  - A1\n- B"));
    expect(m.titulo).toBe("Raiz");
    expect(m.itens).toEqual([
      { texto: "A", nota: null, pai: -1 },
      { texto: "A1", nota: null, pai: 0 },
      { texto: "B", nota: null, pai: -1 },
    ]);
  });

  it("ramo sem texto some e os filhos sobem; texto vira uma linha de até 200", () => {
    const raiz: RamoImportado = {
      texto: "R",
      filhos: [{ texto: "  ", filhos: [{ texto: "linha\nquebrada " + "x".repeat(300), filhos: [] }] }],
    };
    const m = arvoreParaMapa(raiz);
    expect(m.itens).toHaveLength(1);
    expect(m.itens[0].pai).toBe(-1);
    expect(m.itens[0].texto.startsWith("linha quebrada x")).toBe(true);
    expect(m.itens[0].texto.length).toBe(200);
  });

  it("corta no limite de ramos e conta o que ficou de fora", () => {
    const filhos = Array.from({ length: MAX_NOS_POR_MAPA + 10 }, (_, i) => ({ texto: `R${i}`, filhos: [] }));
    const m = arvoreParaMapa({ texto: "Grande", filhos });
    expect(m.itens).toHaveLength(MAX_NOS_POR_MAPA - 1);
    expect(m.cortados).toBe(11);
  });
});

describe("recolhidosIniciais (abrir só com os ramos principais)", () => {
  it("centro com um único filho (data): a cadeia fica aberta e os ramos principais aparecem fechados", () => {
    // Centro → 13/10/26 → Produto(→ DHO60(→ prompt)), Anúncios(→ Drive), Plano
    const m = arvoreParaMapa(lerMarkdown("# C\n- 13/10/26\n  - Produto\n    - DHO60\n      - prompt\n  - Anúncios\n    - Drive\n  - Plano"));
    expect(m.itens.map((i) => i.texto)).toEqual(["13/10/26", "Produto", "DHO60", "prompt", "Anúncios", "Drive", "Plano"]);
    expect(recolhidosIniciais(m.itens)).toEqual([false, true, true, false, true, false, false]);
  });

  it("centro com vários ramos: todos à mostra e fechados; folhas nunca recolhem", () => {
    const m = arvoreParaMapa(lerMarkdown("# C\n- A\n  - A1\n- B"));
    expect(recolhidosIniciais(m.itens)).toEqual([true, false, false]);
  });
});

describe("lerTextoDoZip (.xmind)", () => {
  /** Zip mínimo com um arquivo comprimido (deflate), como o XMind grava. */
  function zipCom(nome: string, texto: string): ArrayBuffer {
    const nomeBytes = Buffer.from(nome);
    const dados = deflateRawSync(Buffer.from(texto));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt16LE(nomeBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt16LE(nomeBytes.length, 28);
    central.writeUInt32LE(0, 42);
    const inicioCentral = 30 + nomeBytes.length + dados.length;
    const fim = Buffer.alloc(22);
    fim.writeUInt32LE(0x06054b50, 0);
    fim.writeUInt16LE(1, 10);
    fim.writeUInt32LE(46 + nomeBytes.length, 12);
    fim.writeUInt32LE(inicioCentral, 16);
    const zip = Buffer.concat([local, nomeBytes, dados, central, nomeBytes, fim]);
    return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.length);
  }

  it("abre o content.json de um .xmind e lê o mapa", async () => {
    const json = JSON.stringify([{ rootTopic: { title: "Ação", children: { attached: [{ title: "Passo" }] } } }]);
    const lido = await lerTextoDoZip(zipCom("content.json", json), ["content.json", "content.xml"]);
    expect(lido?.nome).toBe("content.json");
    expect(forma(lerXMindJson(lido!.texto))).toBe("Ação(Passo)");
  });

  it("zip bomb: para de descompactar acima do teto", async () => {
    const enorme = "a".repeat(MAX_DESCOMPACTADO_ZIP + 1024); // comprime pra poucos KB
    await expect(lerTextoDoZip(zipCom("content.json", enorme), ["content.json"])).rejects.toThrow(/grande demais/);
  });

  it("devolve null se o arquivo procurado não existe; erro se não é zip", async () => {
    expect(await lerTextoDoZip(zipCom("outro.txt", "x"), ["content.json"])).toBeNull();
    await expect(lerTextoDoZip(new ArrayBuffer(40), ["content.json"])).rejects.toThrow(/não é um .xmind/);
  });
});

describe("formatoDoArquivo e entidades", () => {
  it("reconhece cada formato pela extensão ou tipo", () => {
    expect(formatoDoArquivo("a.xmind", "")).toBe("xmind");
    expect(formatoDoArquivo("a.MM", "")).toBe("freemind");
    expect(formatoDoArquivo("a.md", "")).toBe("markdown");
    expect(formatoDoArquivo("foto", "image/jpeg")).toBe("imagem");
    expect(formatoDoArquivo("a.pdf", "")).toBe("pdf");
    expect(formatoDoArquivo("a.docx", "")).toBeNull();
  });

  it("decodifica entidades nomeadas e numéricas", () => {
    expect(decodificarEntidades("a &lt;b&gt; &#xE9; &#233; &amp;amp;")).toBe("a <b> é é &amp;");
  });
});
