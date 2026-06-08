"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[PWA] service worker registered:", registration.scope);
      })
      .catch((err) => {
        console.warn("[PWA] service worker registration failed:", err);
      });
  }, []);

  return null;
}
