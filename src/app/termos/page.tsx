import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Serviço — Gaiamum",
};

export default function PaginaTermos() {
  return (
    <main className="min-h-screen bg-gaiamum-bg px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-8 text-gaiamum-text">
        <h1 className="mb-1 text-2xl font-semibold">Termos de Serviço</h1>
        <p className="mb-8 text-sm text-gaiamum-text-muted">Última atualização: 1 de setembro de 2026</p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-gaiamum-text">
          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">1. Sobre o Gaiamum</h2>
            <p>
              O Gaiamum é um sistema de gestão para organizar projetos, tarefas, financeiro e agenda de
              pequenos negócios e times. Ao criar uma conta ou acessar o Gaiamum, você concorda com estes
              Termos de Serviço.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">2. Sua conta</h2>
            <p>
              Você é responsável por manter a confidencialidade das suas credenciais de acesso e por todas
              as informações inseridas na sua conta. Ao usar o login com Google, seu acesso ao Gaiamum
              depende da sua Conta Google estar ativa e você ter concedido a permissão necessária.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">3. Uso permitido</h2>
            <p>
              O Gaiamum deve ser usado para fins lícitos, dentro do propósito para o qual foi criado
              (gestão de projetos, financeiro e agenda). Você é responsável pela veracidade e legalidade do
              conteúdo que insere no sistema.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">4. Disponibilidade do serviço</h2>
            <p>
              O Gaiamum está em evolução contínua e pode passar por manutenções, mudanças de funcionalidade
              ou indisponibilidade temporária. Fazemos o possível para manter o serviço estável, mas não
              garantimos disponibilidade ininterrupta.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">5. Limitação de responsabilidade</h2>
            <p>
              O Gaiamum é fornecido &quot;como está&quot;. Na máxima extensão permitida por lei, não nos
              responsabilizamos por perdas indiretas decorrentes do uso do sistema. Recomendamos manter
              cópias externas de informações críticas do seu negócio.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">6. Cancelamento</h2>
            <p>
              Você pode deixar de usar o Gaiamum e solicitar a exclusão da sua conta e dos seus dados a
              qualquer momento, entrando em contato pelo e-mail abaixo.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">7. Alterações destes termos</h2>
            <p>
              Estes termos podem ser atualizados conforme o Gaiamum evolui. A data no topo desta página
              sempre indica a versão mais recente.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">8. Contato</h2>
            <p>
              Dúvidas sobre estes termos: {" "}
              <a href="mailto:ceo.ifaz@gmail.com" className="underline underline-offset-2">
                ceo.ifaz@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
