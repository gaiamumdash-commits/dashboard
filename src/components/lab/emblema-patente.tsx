import Link from "next/link";
import Image from "next/image";
import { ROTULO_PATENTE, type CodigoPatente } from "@/lib/ecc/lab/patentes";

/** Selo compacto pro menu lateral — a patente Master se destaca visualmente
 * (cor de aviso/ouro) por ser a única conquistada fora do Lab, no produto
 * real. */
export function EmblemaPatente({ codigo }: { codigo: CodigoPatente }) {
  const destaque = codigo === "master";

  return (
    <Link
      href="/lab/progresso"
      title="Sua patente no Gaiamum Lab"
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:opacity-80 ${
        destaque
          ? "border-gaiamum-warning bg-gaiamum-warning/10 text-gaiamum-warning"
          : "border-gaiamum-border bg-gaiamum-surface-raised text-gaiamum-text-muted"
      }`}
    >
      <Image src="/brand/crab-mark.png" alt="" width={14} height={14} />
      {ROTULO_PATENTE[codigo]}
    </Link>
  );
}
