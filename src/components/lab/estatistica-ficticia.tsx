/** Estatística de incentivo do Lab — o aviso de "isso é uma simulação" é
 * dado uma única vez, na entrada do Lab (app/lab/page.tsx); repetir isso a
 * cada estatística tiraria o clima de jogo. Por isso aqui é só um destaque
 * animador, sem rótulo nenhum de "fictício"/"case" — o usuário já sabe que
 * está no Lab. */
export function EstatisticaFicticia({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-gaiamum-primary/30 bg-gaiamum-primary/5 p-4">
      <p className="text-sm font-medium text-gaiamum-text">🔥 {texto}</p>
    </div>
  );
}
