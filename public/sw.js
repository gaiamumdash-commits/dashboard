// Service worker mínimo — só existe pra tornar o app instalável como PWA.
// Sem cache de assets, sem modo offline: Web Push entra quando o módulo de
// notificações for priorizado (mesmo padrão do UltraQuadras).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
