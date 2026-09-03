import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { contarNaoLidas } from "@/lib/ecc/notificacoes-app";
import { SinoNotificacoes } from "@/components/layout/sino-notificacoes";
import { BotaoSair } from "@/components/layout/botao-sair";
import { LinksNavegacao } from "@/components/layout/links-navegacao";
import { MenuMobile } from "@/components/layout/menu-mobile";

/** Busca a contagem de não lidas separada num componente próprio, dentro de
 * `<Suspense>` — sem isso, `MenuLateral` (renderizado em toda página do
 * sistema) precisaria ser `async` e sua consulta rodaria DEPOIS de todas as
 * consultas da própria página (mais uma viagem de rede sequencial somada em
 * todo lugar). Com Suspense, o resto da página não espera o sino: o shell
 * inteiro renderiza na hora e só o número do sino aparece um instante depois. */
async function SinoComContagem({ alinhamento }: { alinhamento?: "left" | "right" }) {
  const naoLidas = await contarNaoLidas();
  return <SinoNotificacoes naoLidasIniciais={naoLidas} alinhamento={alinhamento} />;
}

export function MenuLateral({
  temMetasSmart,
  acessoCompleto = true,
  souOwner = false,
}: {
  temMetasSmart: boolean;
  acessoCompleto?: boolean;
  souOwner?: boolean;
}) {
  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gaiamum-border bg-gaiamum-surface px-4 py-6 sm:flex">
        <div className="mb-8 flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/crab-mark.png" alt="" width={32} height={32} />
            <span className="text-lg font-semibold text-gaiamum-text">Gaiamum</span>
          </Link>
          <Suspense fallback={<SinoNotificacoes naoLidasIniciais={0} />}>
            <SinoComContagem />
          </Suspense>
        </div>

        <LinksNavegacao temMetasSmart={temMetasSmart} acessoCompleto={acessoCompleto} souOwner={souOwner} />

        <div className="mt-auto flex flex-col border-t border-gaiamum-border pt-3">
          <BotaoSair />
        </div>
      </aside>

      <MenuMobile
        temMetasSmart={temMetasSmart}
        acessoCompleto={acessoCompleto}
        souOwner={souOwner}
        sino={
          <Suspense fallback={<SinoNotificacoes naoLidasIniciais={0} alinhamento="right" />}>
            <SinoComContagem alinhamento="right" />
          </Suspense>
        }
      />
    </>
  );
}
