/** Card "Sugestão" do mockup. O texto é CALCULADO (consistência real da
 * semana, `sugestaoDaSemana`), não gerado por IA — por isso o título não
 * diz "IA". A reorganização automática é fase posterior e, quando vier,
 * só muda dados depois de uma prévia confirmada pela pessoa; até lá o botão
 * fica desabilitado com "Em breve". */
export function CardSugestao({ texto }: { texto: string | null }) {
  return (
    <section className="flex h-full flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gaiamum-tag-purple">
        <span aria-hidden>✨</span> Sugestão do Gaiamum
      </h2>
      <p className="flex-1 text-sm text-gaiamum-text">
        {texto ?? "Assim que você marcar hábitos e rotinas desta semana, aparece aqui uma leitura de como ela está indo."}
      </p>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Em breve: a IA propõe uma reorganização e você revisa antes de qualquer mudança."
        className="cursor-not-allowed rounded-lg bg-gaiamum-tag-purple/80 px-4 py-2 text-sm font-medium text-white opacity-70"
      >
        Reorganizar minha semana · Em breve
      </button>
    </section>
  );
}
