// Chamunda Kitchen service worker: lets the owner screen install as an app and show
// order notifications. It does not cache anything, so the app is always the latest version.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  /* network only */
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.includes("/kitchen-boss/") && "focus" in c) return c.focus();
      return self.clients.openWindow("/chamunda-cafe/kitchen-boss/");
    })
  );
});
