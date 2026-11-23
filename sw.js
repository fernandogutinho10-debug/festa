// Service worker mínimo: permite instalar o app. Não guarda cache, então o site está sempre atualizado.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
