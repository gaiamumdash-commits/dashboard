"use client";

import { useId, useState } from "react";

/** Campo de senha com a caixa "Mostrar senha" logo abaixo — pedido do Fabio
 * (2026-10-05/06): a Angeline errava a senha sem conseguir ver o que tinha
 * digitado. A 1ª versão usava um ícone de olho dentro do campo, discreto
 * demais (ele não achou); uma caixa de marcar com texto é impossível de
 * não ver. */
export function CampoSenha({
  value,
  onChange,
  minLength = 6,
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (valor: string) => void;
  minLength?: number;
  autoComplete?: "current-password" | "new-password";
}) {
  const [visivel, setVisivel] = useState(false);
  const idCaixa = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type={visivel ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
      />
      {/* Sem <label> aqui: quem usa este campo já o envolve num <label>
          ("Senha"), e label dentro de label é HTML inválido. O texto
          clicável alterna a caixa via onClick. */}
      <span className="flex items-center gap-2">
        <input
          id={idCaixa}
          type="checkbox"
          checked={visivel}
          onChange={(e) => setVisivel(e.target.checked)}
          aria-label="Mostrar senha"
          className="h-4 w-4 accent-gaiamum-primary"
        />
        <span
          onClick={(e) => {
            e.preventDefault();
            setVisivel((v) => !v);
          }}
          className="cursor-pointer select-none text-xs text-gaiamum-text-muted"
        >
          Mostrar senha
        </span>
        {/* Só em senha NOVA (cadastro/redefinição), onde a regra é 8+. */}
        {minLength >= 8 && <span className="ml-auto text-xs text-gaiamum-text-muted">Mínimo de {minLength} caracteres</span>}
      </span>
    </div>
  );
}
