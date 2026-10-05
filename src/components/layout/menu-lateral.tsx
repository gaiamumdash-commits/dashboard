import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { contarNaoLidas } from "@/lib/ecc/notificacoes-app";
import { listarPatentesDoUsuario, patenteMaisAlta } from "@/lib/ecc/lab/patentes";
import { souDonoDoSaas } from "@/lib/ecc/dono-saas";
import { SinoNotificacoes } from "@/components/layout/sino-notificacoes";
import { BotaoSair } from "@/components/layout/botao-sair";
import { EmailDaConta } from "@/components/layout/email-da-conta";
import { LinksNavegacao } from "@/components/layout/links-navegacao";
import { MenuLateralRetratil } from "@/components/layout/menu-lateral-retratil";
import { MenuMobile } from "@/components/layout/menu-mobile";
import { EmblemaPatente } from "@/components/lab/emblema-patente";
import { BotaoInstalarAppMenu } from "@/components/instalar-app/convite-instalar-app";
import { LAB_VISIVEL } from "@/lib/ecc/lab/flags";

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

/** Mesmo padrão do sino acima: busca própria dentro de `<Suspense>`, sem
 * bloquear o resto do menu. `null` (sem selo nenhum) até a pessoa conquistar
 * a primeira patente no Gaiamum Lab. */
async function PatenteComEmblema() {
  const user = await obterUsuarioAtual();
  if (!user) return null;
  const patentes = await listarPatentesDoUsuario(user.id);
  const atual = patenteMaisAlta(patentes);
  if (!atual) return null;
  return <EmblemaPatente codigo={atual} />;
}

/** Mesmo padrão do sino/patente: busca própria dentro de `<Suspense>`.
 * Normalmente nunca esconde o link do Lab — antes de concluir, convite a
 * explorar; depois de conquistar a patente 'explorador', só troca o
 * rótulo/selo pra sinalizar que virou material de consulta, não pendência
 * (pedido explícito do Fabio: o Lab é referência viva de gestão, não um
 * tutorial descartável).
 * Lab escondido visualmente (2026-10-02, pedido do Fabio: "não está
 * funcionando, hoje ele só causa uma experiência ruim"): enquanto
 * `LAB_VISIVEL` for `false`, este link não aparece pra ninguém, nem pra
 * quem já tem a patente. Nada do Lab foi apagado — só este ponto de
 * entrada (e os outros, ver `flags.ts`) ficam ocultos. */
async function LinkLabCondicional() {
  if (!LAB_VISIVEL) return null;
  const user = await obterUsuarioAtual();
  if (!user) return null;
  const patentes = await listarPatentesDoUsuario(user.id);
  const concluido = patentes.some((p) => p.codigo === "explorador");
  return (
    <Link
      href="/lab"
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
    >
      <span>{concluido ? "🎮 Lab · Rever o guia" : "🎮 Gaiamum Lab"}</span>
      {concluido && (
        <span className="rounded-full bg-gaiamum-success/15 px-2 py-0.5 text-xs font-semibold text-gaiamum-success">
          ✓
        </span>
      )}
    </Link>
  );
}

/** Mesmo padrão do sino/patente: busca própria dentro de `<Suspense>` — item
 * de menu restrito só à conta pessoal do dono do SaaS (não confundir com
 * `souOwner`, que é "dono deste workspace", concedido a qualquer cliente). */
async function LinkAnaliticaDoSaas() {
  if (!(await souDonoDoSaas())) return null;
  return (
    <Link
      href="/admin/analitica-lab"
      className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
    >
      📊 Analítica do Lab
    </Link>
  );
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
      {/* Critério de visibilidade (achado real, 2026-10-01): NÃO é só a
          largura (`sm:`, 640px) — um celular DEITADO facilmente ultrapassa
          isso (ex.: 844px) e ativaria este menu, roubando espaço do quadro
          kanban exatamente na hora em que mais sobra espaço útil. Por isso
          soma `pointer: fine` (mouse de verdade) como critério independente
          de largura — só aparece em desktop/notebook real; qualquer
          dispositivo de toque, não importa a largura, usa o `MenuMobile`
          (cabeçalho + painel) abaixo. A largura/retração em si (sticky,
          h-screen, recolher/expandir) vive em `MenuLateralRetratil` — pedido
          do Fabio (2026-10-04): "quero usar o cartão Kanban na tela
          inteira... deixa o menu retrátil". */}
      <MenuLateralRetratil>
        <div className="mb-8 flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/crab-mark.png" alt="" width={32} height={32} />
            <span className="text-lg font-semibold text-gaiamum-text">Gaiamum</span>
          </Link>
          <Suspense fallback={<SinoNotificacoes naoLidasIniciais={0} />}>
            <SinoComContagem />
          </Suspense>
        </div>

        <div className="mb-4 px-2">
          <Suspense fallback={null}>
            <PatenteComEmblema />
          </Suspense>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <LinksNavegacao
            temMetasSmart={temMetasSmart}
            acessoCompleto={acessoCompleto}
            souOwner={souOwner}
            linkLab={
              <Suspense fallback={null}>
                <LinkLabCondicional />
              </Suspense>
            }
            extra={
              <Suspense fallback={null}>
                <LinkAnaliticaDoSaas />
              </Suspense>
            }
          />
        </div>

        <div className="mt-3 flex shrink-0 flex-col border-t border-gaiamum-border pt-3">
          <BotaoInstalarAppMenu />
          <Suspense fallback={null}>
            <EmailDaConta />
          </Suspense>
          <BotaoSair />
        </div>
      </MenuLateralRetratil>

      <MenuMobile
        temMetasSmart={temMetasSmart}
        acessoCompleto={acessoCompleto}
        souOwner={souOwner}
        sino={
          <Suspense fallback={<SinoNotificacoes naoLidasIniciais={0} alinhamento="right" />}>
            <SinoComContagem alinhamento="right" />
          </Suspense>
        }
        linkLab={
          <Suspense fallback={null}>
            <LinkLabCondicional />
          </Suspense>
        }
        linkExtra={
          <Suspense fallback={null}>
            <LinkAnaliticaDoSaas />
          </Suspense>
        }
        emailConta={
          <Suspense fallback={null}>
            <EmailDaConta />
          </Suspense>
        }
      />
    </>
  );
}
