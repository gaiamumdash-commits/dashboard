import Image from "next/image";

export function BarraProgresso({ percentual, rotulo }: { percentual: number; rotulo?: string }) {
  const completo = percentual >= 100;
  // O caranguejo anda em cima da trilha seguindo o preenchimento; span de 0%
  // a 100% do próprio caranguejo, não da barra (senão ele passaria da toca).
  const posicaoCaranguejo = `calc(${Math.min(percentual, 100)}% * 0.92)`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-gaiamum-text-muted">
        <span>{rotulo ?? "Progresso"}</span>
        <span className={`font-semibold transition-opacity ${completo ? "text-gaiamum-success opacity-0" : "text-gaiamum-primary"}`}>
          {percentual}%
        </span>
      </div>

      <div className="relative h-6 w-full">
        {/* Trilha */}
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-gaiamum-surface-raised">
          <div
            className="h-full rounded-full bg-gaiamum-primary transition-all duration-500 ease-out"
            style={{ width: `${percentual}%` }}
          />
        </div>

        {/* Toca: montinho de terra com o buraco no topo, o destino do caranguejo. Discreto de propósito — é um detalhe, não o protagonista da tela. */}
        <svg
          viewBox="0 0 40 28"
          className={`absolute -right-0.5 top-1/2 h-6 w-8 -translate-y-1/2 rounded-full opacity-70 transition-all duration-300 ${
            completo ? "opacity-100 ring-2 ring-gaiamum-primary ring-offset-2 ring-offset-gaiamum-bg" : ""
          }`}
        >
          <ellipse cx="20" cy="22" rx="18" ry="5.5" fill="#8d8d88" />
          <ellipse cx="20" cy="19.5" rx="13" ry="4.5" fill="#a8a8a2" />
          <ellipse cx="20" cy="17" rx="6.5" ry="5.5" fill="#050505" />
        </svg>

        {/* Caranguejo: anda com a barra, encolhe e some dentro da toca ao chegar em 100% */}
        <div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{
            left: posicaoCaranguejo,
            transform: `translate(-50%, -50%) scale(${completo ? 0 : 1})`,
            opacity: completo ? 0 : 1,
          }}
        >
          <Image src="/brand/crab-mark.png" alt="" width={20} height={20} />
        </div>
      </div>

      {completo && (
        <p className="text-xs font-medium text-gaiamum-success">Tudo preenchido — o Gaiamum chegou na toca. 🎉</p>
      )}
    </div>
  );
}
