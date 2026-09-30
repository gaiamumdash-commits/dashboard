// Stub vazio pro pacote "server-only" dentro dos testes — em produção, o
// bundler do Next.js substitui esse módulo automaticamente (é assim que ele
// impede um Client Component de importar código server-only); o Vitest não
// tem esse tratamento especial, e o pacote real sempre lança uma exceção ao
// ser importado (ver node_modules/server-only/index.js) — sem este stub,
// todo arquivo de `src/lib/ecc` que começa com `import "server-only"`
// quebraria só de ser importado pelo teste, mesmo sem usar nenhum recurso
// real de servidor. Mapeado via `resolve.alias` em vitest.config.ts.
export {};
