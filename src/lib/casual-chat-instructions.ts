import { decryptHintBody } from "@/lib/encryption";
import type { DailyQuestionRoundDetail } from "@/lib/daily-question-types";
import type { ChatProfileContext } from "@/lib/chat-profile-context";

type PartnerInsightRow = {
  partner_hint_encrypted: string | null;
  partner_hint_iv: string | null;
  partner_hint_auth_tag: string | null;
  created_at: string;
};

const CASUAL_CHAT_INSTRUCTIONS = `あなたはカップルの「日常の聞き友達」です。
相談アドバイザーではありません。悩みの整理・助言・返信文の作成はしません。

【絶対ルール — 1つでも破ったら不合格】
1. 日本語のみ。2〜3文以内（80文字目安、最大120文字）
2. 最終文は必ず「？」で終わる、答えやすい質問を1つだけ
3. 箇条書き・引用（>）・「ポイントは」・長い説教は禁止
4. 「〜した方がいい」「伝えましょう」「整理すると」は禁止
5. ユーザーが悩みを話しても、解決策は出さず共感＋軽い質問のみ

【トーン】
- 友達のように温かく、テンポよく
- 日常・惚気・小さな出来事を一緒に広げる
- 相手の言葉を受け止めてから、好奇心で1問

【良い例】
ユーザー「今日物件見てきた」
→「いいね、どんな雰囲気だった？小春と暮らすイメージも湧いた？」

ユーザー「延期してもいいと思う？」
→「うん、無理せずでいいと思う。来週会う前に、今どんな気持ちが一番大きい？」

【悪い例 — 絶対に出さない】
- 4段落の分析、返信文の提案、> 引用ブロック
- 最後が「〜だと思う。」で終わる（質問で終わっていない）`;

export const CASUAL_RETRY_INSTRUCTIONS = `${CASUAL_CHAT_INSTRUCTIONS}

【再生成】
前の返答は長すぎるか、質問で終わっていませんでした。
2〜3文だけ。最後は必ず「？」で終わる質問1つにしてください。`;

function formatName(value: string | null | undefined, fallback: string): string {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function buildCasualContextSection(
  profileContext: ChatProfileContext,
  dailyQuestionRounds: DailyQuestionRoundDetail[]
): string {
  const self = profileContext.self;
  const partner = profileContext.partner;
  let section =
    `\n\n【補助情報（断定しない）】\n` +
    `・相談者: ${formatName(self.displayName, "あなた")}\n` +
    `・パートナー: ${formatName(partner?.displayName, "パートナー")}\n`;

  if (dailyQuestionRounds.length > 0) {
    const latest = dailyQuestionRounds[0];
    section += `・最近のふたり質問: ${latest.question}\n`;
  }

  return section;
}

export function buildCasualChatInstructions(
  profileContext: ChatProfileContext,
  partnerInsights: PartnerInsightRow[],
  dailyQuestionRounds: DailyQuestionRoundDetail[] = []
): string {
  let instructions = CASUAL_CHAT_INSTRUCTIONS;
  instructions += buildCasualContextSection(profileContext, dailyQuestionRounds);

  if (partnerInsights.length > 0) {
    const hints = partnerInsights
      .slice(0, 5)
      .map((i) => decryptHintBody(i))
      .filter(Boolean);
    if (hints.length > 0) {
      instructions +=
        "\n※ 以下は関係の背景ヒント。引用せず、質問のヒント程度に。\n" +
        hints.map((h) => `・${h}`).join("\n");
    }
  }

  return instructions;
}

/** 雑談返答が要件を満たすか */
export function isValidCasualResponse(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > 160) return false;
  if (/^>/m.test(trimmed) || trimmed.includes("ポイントは")) return false;
  if (/伝えましょう|した方がいい|整理すると|返信案/.test(trimmed)) return false;

  const lastChar = trimmed.slice(-1);
  if (lastChar !== "？" && lastChar !== "?") return false;

  return true;
}

export function isCasualConsultation(
  kind: string | null | undefined,
  title: string | null | undefined
): boolean {
  return kind === "casual" || title === "雑談";
}
