"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePushNotification } from "@/lib/push/use-push-notification";

/** AppHeader（py-3 + 1行）の高さ。ヘッダーは暗くしない */
const PANEL_TOP = "calc(env(safe-area-inset-top, 0px) + 3.5rem)";

function NotificationPanel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      {/* ヘッダー下〜画面下端を暗く（白パネルより背面） */}
      <button
        type="button"
        aria-label="閉じる"
        className="fixed inset-x-0 bottom-0 z-[100] bg-black/40"
        style={{ top: PANEL_TOP }}
        onClick={onClose}
      />
      {/* ヘッダー直下に白パネル */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-sheet-title"
        className="fixed left-1/2 z-[101] w-full max-w-lg -translate-x-1/2 max-h-[70dvh] overflow-y-auto bg-white border-b-2 border-x-2 border-rose-100 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-b-2xl px-5 py-5"
        style={{ top: PANEL_TOP }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const push = usePushNotification();

  if (push.status === "unsupported") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="通知"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg border-2 border-gray-100 bg-white shadow-[2px_2px_0_rgba(148,163,184,0.12)] hover:border-rose-100 transition-colors shrink-0"
      >
        <span className="text-base leading-none" aria-hidden>
          🔔
        </span>
        {push.showBadge && (
          <span
            className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"
            aria-hidden
          />
        )}
      </button>

      <NotificationPanel open={open} onClose={() => setOpen(false)}>
        {push.isNotificationEnabled ? (
          <EnabledPanelContent push={push} onClose={() => setOpen(false)} />
        ) : (
          <OffPanelContent push={push} />
        )}
      </NotificationPanel>
    </>
  );
}

function OffPanelContent({
  push,
}: {
  push: ReturnType<typeof usePushNotification>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2
          id="notification-sheet-title"
          className="text-base font-black text-gray-800 tracking-tight"
        >
          AiAiからのお知らせ
        </h2>
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          通知をONにすると
        </p>
        <ul className="text-sm text-gray-600 mt-2 space-y-1 pl-1">
          <li>・ふたり質問</li>
          <li>・記念日</li>
          <li>・AiAiからのお知らせ</li>
        </ul>
        <p className="text-sm text-gray-600 mt-2">を受け取れます</p>
      </div>

      {push.status === "denied" ? (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
          通知がブロックされています。ブラウザの設定から AiAi の通知を許可してください。
        </p>
      ) : (
        <button
          type="button"
          onClick={() => push.enable()}
          disabled={push.status === "enabling"}
          className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors text-sm"
        >
          {push.status === "enabling" ? "設定中..." : "通知をONにする"}
        </button>
      )}

      {push.errorMessage && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
          {push.errorMessage}
        </p>
      )}
    </div>
  );
}

function EnabledPanelContent({
  push,
  onClose,
}: {
  push: ReturnType<typeof usePushNotification>;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2
          id="notification-sheet-title"
          className="text-base font-black text-gray-800 tracking-tight"
        >
          通知設定
        </h2>
        <p className="text-sm text-emerald-600 font-bold mt-3">
          ✓ 通知は有効です
        </p>
      </div>

      {push.dbSubscriptionCount === 0 && (
        <div className="space-y-2">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            通知登録がまだありません。
          </p>
          <button
            type="button"
            onClick={() => push.reregister()}
            disabled={push.reregistering}
            className="w-full border-2 border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50 font-bold py-2.5 rounded-xl transition-colors text-xs"
          >
            {push.reregistering ? "再登録中..." : "通知登録を再保存する"}
          </button>
        </div>
      )}

      {push.isDev && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => push.sendTest()}
            disabled={
              push.testUi === "loading" || push.dbSubscriptionCount === 0
            }
            className="w-full border-2 border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 font-bold py-2.5 rounded-xl transition-colors text-sm"
          >
            {push.testUi === "loading" ? "送信中..." : "テスト通知を送る"}
          </button>

          {push.testUi === "success" && push.testMessage && (
            <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              {push.testMessage}
            </p>
          )}

          {push.testUi === "error" && push.testMessage && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {push.testMessage}
            </p>
          )}
        </div>
      )}

      {push.errorMessage && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
          {push.errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full text-gray-400 text-xs font-bold py-2"
      >
        閉じる
      </button>
    </div>
  );
}
