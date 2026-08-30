import type { Horizonte } from "@/lib/ecc/tipos";

export const HORIZONTES: { valor: Horizonte; titulo: string; ajuda: string; placeholder: string }[] = [
  {
    valor: "medio_prazo",
    titulo: "Médio prazo (1 a 3 anos)",
    ajuda: "Onde seu negócio precisa estar pra você considerar os próximos 1 a 3 anos um sucesso.",
    placeholder: "Ex.: consolidar o Gaiamum como a ferramenta de gestão principal de 50 pequenos negócios pagantes.",
  },
  {
    valor: "longo_prazo",
    titulo: "Longo prazo (3 a 5+ anos)",
    ajuda: "A visão maior: o que esse negócio se torna se der tudo certo no longo prazo.",
    placeholder: "Ex.: ser a plataforma de referência em gestão pra pequenos negócios no Brasil.",
  },
];

export const CAMPOS_SMART: {
  campo: "specific" | "measurable" | "attainable" | "relevant" | "time_bound";
  letra: string;
  titulo: string;
  ajuda: string;
  placeholder: string;
}[] = [
  {
    campo: "specific",
    letra: "S",
    titulo: "Específica",
    ajuda: "O que exatamente vai acontecer? Seja concreto, sem generalidade.",
    placeholder: "Ex.: lançar o módulo financeiro com fluxo de caixa e conciliação bancária.",
  },
  {
    campo: "measurable",
    letra: "M",
    titulo: "Mensurável",
    ajuda: "Qual número ou marco prova que a meta foi atingida?",
    placeholder: "Ex.: 50 clientes pagantes usando o módulo toda semana.",
  },
  {
    campo: "attainable",
    letra: "A",
    titulo: "Atingível",
    ajuda: "Com os recursos e o tempo que você tem hoje, isso é realista?",
    placeholder: "Ex.: sim, já tenho a base técnica pronta e 1 dev dedicado full-time.",
  },
  {
    campo: "relevant",
    letra: "R",
    titulo: "Relevante",
    ajuda: "Por que essa meta importa pra sua visão macro do negócio?",
    placeholder: "Ex.: sem controle financeiro, o cliente não confia o negócio inteiro à plataforma.",
  },
  {
    campo: "time_bound",
    letra: "T",
    titulo: "Temporal",
    ajuda: "Até quando isso precisa acontecer? Data ou prazo claro.",
    placeholder: "Ex.: até o fim do primeiro trimestre de 2027.",
  },
];

export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
