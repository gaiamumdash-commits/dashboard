export type CorIcone = "verde" | "vermelho" | "amarelo" | "azul" | "roxo";

const CLASSE_COR: Record<CorIcone, string> = {
  verde: "bg-gaiamum-success text-white",
  vermelho: "bg-gaiamum-danger text-white",
  amarelo: "bg-gaiamum-warning text-black",
  azul: "bg-gaiamum-tag-blue text-white",
  roxo: "bg-gaiamum-tag-purple text-white",
};

const CLASSE_TAMANHO = {
  sm: "h-7 w-7 text-sm",
  md: "h-10 w-10 text-lg",
};

/** Círculo colorido com um símbolo dentro — mesma linguagem visual do print
 * do design (ícone de linha dentro de um círculo sólido). O projeto já usa
 * emoji em headings (`🚩 Marcos`, `📊 Indicadores` em visao-360/page.tsx);
 * aqui o emoji vira o conteúdo do círculo em vez de ficar solto no texto. */
export function IconeCircular({
  cor,
  tamanho = "md",
  children,
}: {
  cor: CorIcone;
  tamanho?: "sm" | "md";
  children: string;
}) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full ${CLASSE_COR[cor]} ${CLASSE_TAMANHO[tamanho]}`}
    >
      {children}
    </span>
  );
}
