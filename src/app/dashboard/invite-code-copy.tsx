"use client";

import { useState } from "react";

export default function InviteCodeCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-base font-mono font-bold tracking-widest text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
        {code}
      </code>
      <button
        onClick={handleCopy}
        className={`shrink-0 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
          copied
            ? "bg-green-50 border-green-200 text-green-600"
            : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        }`}
      >
        {copied ? "コピー済み ✓" : "コピー"}
      </button>
    </div>
  );
}
