import type { Horizonte } from "@/lib/ecc/tipos";

/** Só "médio prazo" é coletado no onboarding — decisão do Fabio (2026-09-09):
 * pedir rigor SMART (mensurável, com prazo) pra um horizonte de 3-5+ anos não
 * é realista pro ritmo de mudança de mercado de hoje, e a maioria não
 * preenchia mesmo (confirmado: só 1 meta real com horizonte 'longo_prazo' em
 * produção antes desta mudança). `Horizonte` continua aceitando
 * 'longo_prazo' no tipo/schema — metas antigas com esse valor continuam
 * existindo e sendo exibidas normalmente (ver ROTULO_HORIZONTE em
 * app/page.tsx), só não é mais oferecido no formulário de criação. */
export const HORIZONTES: { valor: Horizonte; titulo: string; ajuda: string; placeholder: string }[] = [
  {
    valor: "medio_prazo",
    titulo: "Médio prazo (1 a 3 anos)",
    ajuda: "Onde seu negócio precisa estar pra você considerar os próximos 1 a 3 anos um sucesso.",
    placeholder: "Ex.: consolidar o Gaiamum como a ferramenta de gestão principal de 50 pequenos negócios pagantes.",
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
