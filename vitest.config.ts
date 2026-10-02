import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Configuração mínima de testes — só o necessário pra rodar Vitest sobre o
 * código de `src/lib/ecc` (lógica de negócio pura) e os testes de
 * integração/RLS em `tests/integration` (pulados quando não há banco de
 * teste configurado, ver tests/integration/README.md).
 *
 * De propósito SEM plugin de React/JSX: o P0 cobre regras e permissões
 * (lógica pura + banco), não renderização de componente — ver
 * docs/gaiamum/GAIAMUM-RELATORIO-INCREMENTO-P0.md para o raciocínio de
 * escopo.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // "server-only" sempre lança exceção ao ser importado (é assim que o
      // bundler do Next detecta um Client Component importando código de
      // servidor) — o Next troca esse módulo por um stub vazio em build de
      // servidor; o Vitest não tem esse tratamento, então fazemos o mesmo
      // aqui, só para os testes.
      "server-only": path.resolve(__dirname, "./tests/setup/server-only-stub.ts"),
    },
  },
});
