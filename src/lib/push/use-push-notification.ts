"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getVapidPublicKey,
  urlBase64ToUint8Array,
} from "@/lib/push/vapid";

export type PushNotificationStatus =
  | "unsupported"
  | "default"
  | "denied"
  | "enabling"
  | "enabled"
  | "error";

export type PushTestUiState = "idle" | "loading" | "success" | "error";

type PushStatusResponse = {
  dbSubscriptionCount?: number;
  listError?: string | null;
  vapidConfigured?: boolean;
};

type PushTestResponse = {
  ok?: boolean;
  sent?: number;
  subscriptionCount?: number;
  error?: string;
};

function subscriptionToPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) {
    return null;
  }
  return {
    endpoint: json.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  };
}

async function saveSubscriptionToServer(payload: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => null)) as { error?: string } | null;

  console.log("[push] /api/push/subscribe response:", {
    status: res.status,
    ok: res.ok,
    data,
  });

  return { ok: res.ok, error: data?.error ?? null };
}

export function usePushNotification() {
  const [status, setStatus] = useState<PushNotificationStatus>("default");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dbSubscriptionCount, setDbSubscriptionCount] = useState<number | null>(
    null
  );
  const [testUi, setTestUi] = useState<PushTestUiState>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [reregistering, setReregistering] = useState(false);
  const isDev = process.env.NODE_ENV !== "production";

  const isNotificationEnabled = status === "enabled";
  const isFullyRegistered =
    isNotificationEnabled && (dbSubscriptionCount ?? 0) > 0;
  const showBadge = status !== "unsupported" && !isNotificationEnabled;

  const refreshServerStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/push/status");
      const data = (await res.json().catch(() => null)) as
        | PushStatusResponse
        | { error?: string }
        | null;

      console.log("[push] /api/push/status response:", {
        status: res.status,
        data,
      });

      if (!res.ok || !data || !("dbSubscriptionCount" in data)) {
        return;
      }

      setDbSubscriptionCount(data.dbSubscriptionCount ?? 0);

      if (data.listError) {
        setErrorMessage(data.listError);
        setStatus("error");
        return;
      }

      if (!data.vapidConfigured) {
        setErrorMessage(
          "VAPID 鍵が未設定です。.env.local に NEXT_PUBLIC_VAPID_PUBLIC_KEY と VAPID_PRIVATE_KEY を設定してください"
        );
      }
    } catch (err) {
      console.error("[push] status fetch error:", err);
    }
  }, []);

  const ensureDbSubscription = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;

    const payload = subscriptionToPayload(subscription);
    if (!payload) return false;

    console.log("[push] browser subscription exists:", {
      endpoint: payload.endpoint.slice(0, 48) + "…",
    });

    const result = await saveSubscriptionToServer(payload);
    if (!result.ok) {
      setErrorMessage(result.error ?? "subscription の保存に失敗しました");
      setStatus("error");
      return false;
    }

    await refreshServerStatus();
    return true;
  }, [refreshServerStatus]);

  const syncStatus = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setStatus("unsupported");
      return;
    }

    const permission = Notification.permission;
    if (permission === "denied") {
      setStatus("denied");
      return;
    }

    if (permission === "granted") {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          setStatus("enabled");
          await ensureDbSubscription();
          await refreshServerStatus();
          return;
        }
      } catch (err) {
        console.error("[push] syncStatus error:", err);
      }
    }

    setStatus("default");
  }, [ensureDbSubscription, refreshServerStatus]);

  useEffect(() => {
    syncStatus();
  }, [syncStatus]);

  async function enable() {
    setErrorMessage(null);
    setTestMessage(null);
    setStatus("enabling");

    const vapidPublicKey = getVapidPublicKey();
    if (!vapidPublicKey) {
      setStatus("error");
      setErrorMessage(
        "VAPID 鍵が未設定です。.env.local に NEXT_PUBLIC_VAPID_PUBLIC_KEY を設定してください"
      );
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log("[push] Notification.permission:", permission);

      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        console.log("[push] PushManager.subscribe: created");
      } else {
        console.log("[push] PushManager.subscribe: reused existing");
      }

      const payload = subscriptionToPayload(subscription);
      if (!payload) {
        setStatus("error");
        setErrorMessage("subscription の取得に失敗しました");
        return false;
      }

      const result = await saveSubscriptionToServer(payload);
      if (!result.ok) {
        setStatus("error");
        setErrorMessage(result.error ?? "subscription の保存に失敗しました");
        return false;
      }

      setStatus("enabled");
      await refreshServerStatus();
      return true;
    } catch (err) {
      console.error("[push] enable error:", err);
      setStatus("error");
      setErrorMessage("通知の有効化に失敗しました");
      return false;
    }
  }

  async function reregister() {
    setReregistering(true);
    setErrorMessage(null);
    setTestMessage(null);
    try {
      const ok = await ensureDbSubscription();
      if (ok) {
        setTestUi("success");
        setTestMessage("通知登録を再保存しました");
      }
      return ok;
    } finally {
      setReregistering(false);
    }
  }

  async function sendTest() {
    setTestUi("loading");
    setTestMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json().catch(() => null)) as PushTestResponse | null;

      console.log("[push] /api/push/test response:", {
        status: res.status,
        ok: res.ok,
        data,
      });

      if (!res.ok || !data?.ok) {
        setTestUi("error");
        setTestMessage(
          data?.error ??
            (data?.subscriptionCount === 0
              ? "通知登録がまだありません"
              : "テスト送信に失敗しました")
        );
        return false;
      }

      if ((data.sent ?? 0) === 0) {
        setTestUi("error");
        setTestMessage("通知は送信されませんでした（sent: 0）");
        return false;
      }

      setTestUi("success");
      setTestMessage(`テスト通知を送信しました（${data.sent}件）`);
      return true;
    } catch (err) {
      console.error("[push] test send error:", err);
      setTestUi("error");
      setTestMessage("テスト送信に失敗しました");
      return false;
    }
  }

  return {
    status,
    isNotificationEnabled,
    isFullyRegistered,
    showBadge,
    errorMessage,
    dbSubscriptionCount,
    testUi,
    testMessage,
    reregistering,
    isDev,
    enable,
    reregister,
    sendTest,
    refreshServerStatus,
  };
}
