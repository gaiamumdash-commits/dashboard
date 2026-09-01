import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — Gaiamum",
};

export default function PaginaPrivacidade() {
  return (
    <main className="min-h-screen bg-gaiamum-bg px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-8 text-gaiamum-text">
        <h1 className="mb-1 text-2xl font-semibold">Política de Privacidade</h1>
        <p className="mb-8 text-sm text-gaiamum-text-muted">Última atualização: 1 de setembro de 2026</p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-gaiamum-text">
          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">1. Quem é o controlador dos dados</h2>
            <p>
              O Gaiamum é operado por Fabio Azevedo. Para qualquer assunto sobre esta política ou sobre os
              seus dados, entre em contato pelo e-mail{" "}
              <a href="mailto:ceo.ifaz@gmail.com" className="underline underline-offset-2">
                ceo.ifaz@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">2. Quais dados coletamos</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Dados da sua conta:</strong> nome, e-mail e foto de perfil, obtidos diretamente com
                você (cadastro por e-mail/senha) ou através do login com sua Conta Google, quando você
                escolhe essa opção.
              </li>
              <li>
                <strong>Dados que você insere no sistema:</strong> projetos, tarefas, comentários,
                lançamentos financeiros, metas, produtos e demais conteúdos que você cria dentro do Gaiamum
                para organizar o seu negócio.
              </li>
              <li>
                <strong>Dados de integrações opcionais:</strong> se você conectar sua Google Agenda, o
                Gaiamum acessa e cria eventos de calendário em seu nome, apenas para exibi-los e permitir a
                criação de novos compromissos dentro do app — só acontece se você autorizar essa conexão
                explicitamente.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">3. Para que usamos esses dados</h2>
            <p>
              Usamos os dados exclusivamente para operar o Gaiamum: autenticar seu acesso, exibir e
              organizar as informações que você cadastra, enviar notificações por e-mail sobre atividades
              nos seus projetos (quando aplicável) e manter o funcionamento do serviço. Não usamos seus
              dados para publicidade e não os vendemos a terceiros.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">4. Com quem compartilhamos dados</h2>
            <p>Compartilhamos dados apenas com prestadores de serviço estritamente necessários para operar o Gaiamum:</p>
            <ul className="list-disc space-y-1 pl-5 mt-2">
              <li><strong>Supabase</strong> — banco de dados e autenticação.</li>
              <li><strong>Vercel</strong> — hospedagem da aplicação.</li>
              <li><strong>Resend</strong> — envio de e-mails de notificação.</li>
              <li><strong>Google</strong> — login com sua Conta Google e, se você conectar, a API do Google Agenda.</li>
            </ul>
            <p className="mt-2">
              Cada um desses prestadores tem suas próprias políticas de privacidade e é usado só na medida
              necessária para prestar o serviço que você contratou ao usar o Gaiamum.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">5. Segurança</h2>
            <p>
              Os dados de cada workspace são isolados por regras de acesso no banco de dados (Row Level
              Security), garantindo que um usuário não acesse dados de outro workspace. Senhas são
              armazenadas de forma criptografada pelo provedor de autenticação.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">6. Seus direitos</h2>
            <p>
              Nos termos da Lei Geral de Proteção de Dados (LGPD), você pode solicitar a qualquer momento a
              confirmação, o acesso, a correção ou a exclusão dos seus dados pessoais, além da revogação do
              consentimento dado a integrações como o Google Agenda. Basta escrever para{" "}
              <a href="mailto:ceo.ifaz@gmail.com" className="underline underline-offset-2">
                ceo.ifaz@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gaiamum-text">7. Alterações desta política</h2>
            <p>
              Esta política pode ser atualizada conforme o Gaiamum evolui. A data no topo desta página
              sempre indica a versão mais recente.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
