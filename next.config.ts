import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acessar `next dev` por outro dispositivo na mesma rede Wi-Fi
  // (ex.: celular físico testando via IP local) — sem isso, o Next bloqueia
  // silenciosamente recursos de dev (HMR, fontes, e a hidratação do client
  // quebra junto) pra qualquer origem que não seja localhost. Só afeta
  // `next dev`, nunca o build de produção. Ajuste o IP se mudar de rede.
  allowedDevOrigins: ["192.168.0.18"],
  // Default do Next é 1MB pro body de Server Actions — baixo demais pra
  // upload de arquivo (anexo de comprovante/cartão de tarefa aceita até
  // 15MB, ver TAMANHO_MAXIMO_BYTES em src/lib/ecc/anexos.ts). Sem isso,
  // qualquer foto de celular real falhava silenciosamente mesmo com RLS e
  // storage corretos — só não aparecia em testes com arquivo pequeno.
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
  // Cabeçalhos de segurança (auditoria de 2026-10-06 — produção só tinha o
  // HSTS que a Vercel já põe). Sem CSP completa de propósito: o app tem
  // scripts inline (tema, captura do convite de instalação) e fala com
  // Supabase/Google — uma CSP restritiva mal calibrada quebra o login. Aqui
  // só `frame-ancestors` (ninguém embute o Gaiamum num iframe pra enganar
  // clique). Microfone liberado só pro próprio site (voz na Agenda e no
  // planejamento); câmera e localização bloqueadas.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "gaiamum.com.br" }],
        destination: "https://www.gaiamum.com.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
