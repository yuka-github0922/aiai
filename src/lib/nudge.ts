import OpenAI from "openai";

export type InsightRow = {
  partner_hint: string;
  created_at: string;
};

export type AnniversaryRow = {
  title: string;
  date: string;
};

export type MemoRow = {
  content: string;
  created_at: string;
};

// ─── 共通ユーティリティ ───────────────────────────────────────

function daysUntilNextOccurrence(dateStr: string, today: Date): number {
  const d = new Date(dateStr);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());

  if (thisYear >= todayMidnight) {
    return Math.round((thisYear.getTime() - todayMidnight.getTime()) / 86_400_000);
  }
  const nextYear = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((nextYear.getTime() - todayMidnight.getTime()) / 86_400_000);
}

function timingPhrase(days: number, title: string): string {
  if (days === 0) return `今日は${title}`;
  if (days <= 7)  return `今週は${title}が近づいています`;
  if (days <= 14) return `来週は${title}`;
  return `もうすぐ${title}`;
}

// ─── ルールベース（フォールバック用） ─────────────────────────

const FALLBACK_NUDGES = [
  "日々の忙しさの中で、ふとパートナーのことが気になる瞬間があるかもしれません。\n「最近どう？」と一言声をかけてみるのもよさそうです。",
  "小さな感謝は、言葉にすることでより深く伝わります。\n「ありがとう」と一言メッセージを送ってみるのもよさそうです。",
  "特別なことをしなくても、そばにいる時間が心地よさをつくります。\n今日は一緒にゆっくり過ごす時間を作ってみるのもよさそうです。",
  "ふたりの関係は、日常の小さな積み重ねで育まれます。\nパートナーの好きなものを思い出して、さりげなく気にかけてみるのもよさそうです。",
];

export function generateNudge(
  insights: InsightRow[],
  anniversaries: AnniversaryRow[],
  today: Date = new Date()
): string {
  const upcoming = anniversaries
    .map((a) => ({ ...a, days: daysUntilNextOccurrence(a.date, today) }))
    .filter((a) => a.days >= 0 && a.days <= 30)
    .sort((a, b) => a.days - b.days);

  const nearest = upcoming[0] ?? null;

  if (nearest) {
    return (
      `${timingPhrase(nearest.days, nearest.title)}が近づいています。\n` +
      "「いつもありがとう」と一言伝えてみるのもよさそうです。"
    );
  }

  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return FALLBACK_NUDGES[dayOfYear % FALLBACK_NUDGES.length];
}

// ─── AI 生成 ──────────────────────────────────────────────────

const NUDGE_SYSTEM_PROMPT =
  "あなたはカップル向けのAIアドバイザーです。\n" +
  "提供された情報をもとに、ユーザーへの行動提案を2文で生成してください。\n\n" +
  "【構成】\n" +
  "①1文目：状況や背景（記念日・傾向・具体メモから自然に導く）\n" +
  "②2文目：具体的な行動提案（必ず「〜してみるのもよさそうです。」で終える）\n\n" +
  "【情報の使い方】\n" +
  "- 【具体メモ】はユーザーが実際に記録した事実なので、自然な文脈で参照してよい\n" +
  "  例：「前に〇〇と話していたことがあったので、〜してみるのもよさそうです。」\n" +
  "- 【パートナーの傾向】はAIが抽出した抽象情報なので、そのまま引用せず自然に言い換えて使う\n" +
  "  NG：「前にこう言っていた」「パートナーがこう話していた」など具体的に引用しすぎるのはやめてください\n" +
  "- 【近い記念日】は1文目に自然に組み込む（「あと〇日」などの直接的な表現は使わない）\n\n" +
  "【共通ルール】\n" +
  "- 行動提案は具体的にする（NG:「気持ちを伝える」 OK:「『ありがとう』と一言送る」）\n" +
  "- 存在しない情報は絶対に生成しない\n" +
  "- 大人っぽく、押しつけがましくない表現にする\n" +
  "- 2文合わせて120文字以内\n" +
  "- 2文のみ出力する（説明文・前置き・見出し不要）\n\n" +
  "【例（具体メモあり）】\n" +
  "前に財布が欲しいと話していたことがあったので、今回の記念日に選んでみるのもよさそうです。\n\n" +
  "【例（傾向のみ）】\n" +
  "最近は言葉で気持ちを伝えてもらえると安心しやすいタイミングかもしれません。\n" +
  "短い一言でも「いつもありがとう」と伝えてみるのもよさそうです。";

export async function generateNudgeWithAI(
  insights: InsightRow[],
  anniversaries: AnniversaryRow[],
  memos: MemoRow[],
  today: Date = new Date()
): Promise<string> {
  const upcoming = anniversaries
    .map((a) => ({ ...a, days: daysUntilNextOccurrence(a.date, today) }))
    .filter((a) => a.days >= 0 && a.days <= 30)
    .sort((a, b) => a.days - b.days);

  const hasInsights      = insights.length > 0;
  const hasAnniversaries = upcoming.length > 0;
  const hasMemos         = memos.length > 0;

  if (!hasInsights && !hasAnniversaries && !hasMemos) {
    return generateNudge([], [], today);
  }

  const contextParts: string[] = [];

  if (hasAnniversaries) {
    const lines = upcoming
      .map((a) => `・${timingPhrase(a.days, a.title)}`)
      .join("\n");
    contextParts.push(`【近い記念日】\n${lines}`);
  }

  if (hasMemos) {
    const lines = memos
      .slice(0, 5)
      .map((m) => `・${m.content}`)
      .join("\n");
    contextParts.push(`【具体メモ（ユーザーが記録した事実）】\n${lines}`);
  }

  if (hasInsights) {
    const lines = insights
      .slice(0, 5)
      .map((i) => `・${i.partner_hint}`)
      .join("\n");
    contextParts.push(`【パートナーの最近の傾向（参考・引用禁止）】\n${lines}`);
  }

  const input = contextParts.join("\n\n") + "\n\n上記をもとに、ナッジメッセージを2文で生成してください。";

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: "gpt-5.5",
      instructions: NUDGE_SYSTEM_PROMPT,
      input,
    });

    const text = response.output_text?.trim();
    if (text) return text;
    throw new Error("empty response");
  } catch (err) {
    console.error("generateNudgeWithAI failed, falling back to rule-based:", err);
    return generateNudge(insights, anniversaries, today);
  }
}
