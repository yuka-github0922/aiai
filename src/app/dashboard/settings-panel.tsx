"use client";

import { useState } from "react";
import Link from "next/link";
import InviteCodeCopy from "./invite-code-copy";
import PartnerNicknameEditor from "./partner-nickname-editor";

type Props = {
  email: string;
  joinedAt: string;
  inviteCode: string | null;
  hasPartner: boolean;
  partnerNickname: string | null;
  partnerJoinedAt: string | null;
  summaryTags: string[];
  communicationStyle: string | null;
  defaultOpen?: boolean;
};

export default function SettingsPanel({
  email,
  joinedAt,
  inviteCode,
  hasPartner,
  partnerNickname,
  partnerJoinedAt,
  summaryTags,
  communicationStyle,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <div className="text-center pt-2 pb-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] font-semibold text-gray-400 hover:text-sky-500 transition-colors underline underline-offset-2 decoration-sky-200"
        >
          招待コード・プロフィールなど
        </button>
      </div>
    );
  }

  return (
    <section className="aiai-sticker-card px-4 py-4 mt-1">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-gray-500">その他の設定</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] font-bold text-sky-400 hover:text-sky-500"
        >
          とじる
        </button>
      </div>

      <div className="space-y-4">
        {inviteCode && hasPartner && (
          <div>
            <p className="text-[11px] text-gray-400 mb-2 font-semibold">招待コード</p>
            <InviteCodeCopy code={inviteCode} />
          </div>
        )}

        <div>
            <p className="text-[11px] text-gray-400 mb-1 font-semibold">あなた</p>
          <p className="text-sm text-gray-600">{email}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            参加日: {new Date(joinedAt).toLocaleDateString("ja-JP")}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-gray-400 font-semibold">あなたの情報</p>
            <Link
              href="/settings"
              className="text-[11px] text-sky-500 hover:text-sky-600 font-bold"
            >
              編集 →
            </Link>
          </div>
          {summaryTags.length > 0 || communicationStyle ? (
            <div className="space-y-2">
              {summaryTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {summaryTags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-amber-50 text-amber-800/80 text-xs font-bold px-2.5 py-0.5 rounded-md shadow-[1px_1px_0_rgba(0,0,0,0.06)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {communicationStyle && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                  {communicationStyle}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">まだ入力されていません</p>
          )}
        </div>

        <div>
          <p className="text-[11px] text-gray-400 mb-2 font-semibold">パートナーの呼び名</p>
          {hasPartner && partnerJoinedAt ? (
            <PartnerNicknameEditor
              initialNickname={partnerNickname}
              joinedAt={partnerJoinedAt}
            />
          ) : (
            <p className="text-sm text-gray-400">
              まだパートナーが参加していません
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
