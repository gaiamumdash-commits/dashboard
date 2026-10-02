/** Liga/desliga a VISIBILIDADE do Gaiamum Lab no app — pedido do Fabio,
 * 2026-10-02: "não está funcionando, hoje ele só causa uma experiência
 * ruim, mais pra frente eu retomo... retire apenas visualmente mas
 * mantenha no código". Não apaga nada: rotas, actions, migrations e dados
 * do Lab continuam intactos, só os pontos de entrada (menu, oferta no
 * onboarding, link em Configurações) deixam de aparecer. Reverter é trocar
 * esta constante pra `true` — nenhum outro arquivo precisa mudar. */
export const LAB_VISIVEL = false;
