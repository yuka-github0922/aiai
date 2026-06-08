export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

export function getVapidPrivateKey(): string | null {
  return process.env.VAPID_PRIVATE_KEY ?? null;
}

export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT ?? "mailto:support@aiai.app";
}

/** base64url → Uint8Array（PushManager.subscribe 用） */
export function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
