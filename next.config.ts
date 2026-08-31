import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
