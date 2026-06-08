/// <reference lib="webworker" />
/**
 * AiAi PWA service worker（最小構成）
 * - 現時点: インストール性の土台 + 将来の Push 通知用
 * - キャッシュは行わない（既存の認証・ルーティングに影響しない）
 */
"use strict";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// インストール要件を満たすためのパススルー fetch
self.addEventListener("fetch", () => {});
