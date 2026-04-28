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
    <div className="flex items-center gap-3">
      <code className="flex-1 text-xl font-mono font-bold tracking-widest text-gray-900">
        {code}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
      >
        {copied ? "コピー済み ✓" : "コピー"}
      </button>
    </div>
  );
}
