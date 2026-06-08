/// <reference lib="webworker" />
/**
 * AiAi PWA service worker
 * - インストール性の土台 + Web Push 通知
 * - キャッシュは行わない（認証・ルーティングに影響しない）
 */
"use strict";

self.addEventListener("install", (event) => {
  console.log("[sw] install");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  console.log("[sw] activate");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  console.log("[sw] push event received", {
    hasData: !!event.data,
  });

  let payload = {
    title: "AiAi",
    body: "",
    url: "/home",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        url: parsed.url || "/home",
      };
      console.log("[sw] push payload parsed", payload);
    } catch (err) {
      console.error("[sw] push payload parse error:", err);
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration
      .showNotification(payload.title, {
        body: payload.body,
        icon: "/icon",
        badge: "/icon",
        data: { url: payload.url },
      })
      .then(() => {
        console.log("[sw] showNotification success:", payload.title);
      })
      .catch((err) => {
        console.error("[sw] showNotification failed:", err);
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("[sw] notificationclick", event.notification.data);
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/home";
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            if ("navigate" in client) {
              return client.navigate(absoluteUrl).then(() => client.focus());
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(absoluteUrl);
        }
      })
  );
});
