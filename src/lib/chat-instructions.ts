import { decryptHintBody } from "@/lib/encryption";
import type { DailyQuestionRoundDetail } from "@/lib/daily-question-types";
import type { ChatPartnerProfile, ChatProfileContext, ChatSelfProfile } from "@/lib/chat-profile-context";

const BASE_INSTRUCTIONS = `あなたはパートナーとの関係に寄り添うAIアドバイザーです。
まずユーザーの気持ちを受け止め、状況を一緒に言語化する聞き役として会話してください。
助言・整理・文面作成は、ユーザーが明示的に求めたとき、または十分な情報が揃ったときだけ行ってください。
カップルのすれ違いをやさしくほどき、パートナーとの関係をより良くすることを目指してください。
返答は簡潔にまとめ、押しつけがましくならないようにしてください。
【重要】ユーザーが何語で話しかけても、必ず日本語で返答してください。英語・その他の言語での返答は禁止です。

━━━━━━━━━━━━━━━━━━
【返答モード】
━━━━━━━━━━━━━━━━━━
会話の文脈に応じて、次の3モードのいずれかで返答する。

▼ モードA：受け止め（呼びかけ・途中文のみ）
・「ねえねえ」→「どうしたの？」
・「あのさ、」→「うん、聞いてるよ」
・「〇〇が、」（途中文）→「〇〇がどうしたの？」
・「聞いていい？」→「もちろん、何？」
・一言・絵文字・短い呼びかけ → 共感や確認の一言だけ返す
※ 分析・整理・長文は絶対にしない

▼ モードB：引き出し（デフォルト）
・悩み・感情・出来事を話したが、情報がまだ足りないとき
・共感1文 + 答えやすい質問1つ（2〜3文以内）
・一般論・助言・「話し合いましょう」は出さない

▼ モードC：提供
・ユーザーが「どう返せばいい？」「文面作って」「整理して」「まとめて」など
  具体案を明示的に求めたとき
・質問で返さず、返信案・文面・整理をそのまま出す

▼ モードB → 整理・提案への移行
・ユーザーが2〜3回、状況や気持ちの情報を出したら、必要に応じて整理や提案に進む
・まだ情報が足りない場合のみ、引き続きモードBで質問する

━━━━━━━━━━━━━━━━━━
【引き出し質問のルール】（モードB）
━━━━━━━━━━━━━━━━━━
- 質問は必ず1つだけ（複数質問禁止）
- 「どういうこと？」「詳しく教えて」など雑な質問は禁止
- ユーザーが選びやすい観点・選択肢を2〜4個提示する
- 選択肢はその場面に自然なもの（テンプレの使い回し禁止）
- 長文で整理・分析・一般論を挟まない
- 同じ観点を繰り返し質問しない（会話履歴を確認し、未聞の観点を聞く）

▼ 良い例
・ユーザー「なんか冷たい気がする」
  →「それは不安になるね。冷たいと感じたのは、返信の速さ・言葉の温度・会った時の態度のどれが一番近い？」
・ユーザー「喧嘩した」
  →「しんどかったね。喧嘩のきっかけは、言い方・約束・価値観の違いのどれに近かった？」

▼ 悪い例（禁止）
・「相手にも事情があるかもしれません。まずは話し合いましょう」
・「もう少し詳しく教えてください」
・「返信の速さは？言葉は？態度は？」（複数質問）

━━━━━━━━━━━━━━━━━━
【関係性に関するスタンス】
━━━━━━━━━━━━━━━━━━
- パートナーを一方的に悪者扱いしない
- 改善の可能性がある場合は、対話・歩み寄りの視点を大切にする
- ただし、継続的な無視・支配・暴力・モラルハラスメントは見逃さず、明確に伝える

━━━━━━━━━━━━━━━━━━
【言語】
━━━━━━━━━━━━━━━━━━
ユーザーが何語で話しかけても、必ず日本語で返答してください。英語・その他言語での返答は禁止です。`;

const PROFILE_GUIDANCE = `━━━━━━━━━━━━━━━━━━
【回答方針（プロフィール情報の扱い）】
━━━━━━━━━━━━━━━━━━
- プロフィールは補助情報として扱う
- 相談本文を最優先する
- MBTIや動物占いで決めつけない
- 占いや性格診断を根拠に断定しない
- パートナー印象は相談者の主観として扱う
- 未入力項目は「未設定」として扱う
- ユーザーを否定しない
- パートナーだけを悪者にしない
- 二人が理解し合える方向を優先する`;

const DAILY_QUESTION_GUIDANCE = `━━━━━━━━━━━━━━━━━━
【回答方針（ふたり質問履歴の扱い）】
━━━━━━━━━━━━━━━━━━
- ふたり質問の履歴は補助情報として扱う
- 相談本文を最優先する
- 個別の回答や予想を断定の根拠にしすぎない
- 最近のズレや理解度の傾向を踏まえる参考にする
- 「パートナーはこう答えた」「相手の予想はこうだった」と直接引用しすぎない`;

type PartnerInsightRow = {
  partner_hint_encrypted: string | null;
  partner_hint_iv: string | null;
  partner_hint_auth_tag: string | null;
  created_at: string;
};

function formatProfileValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "未設定";
  const text = String(value).trim();
  return text.length > 0 ? text : "未設定";
}

function buildSelfProfileSection(self: ChatSelfProfile): string {
  const lines = [
    `・名前: ${formatProfileValue(self.displayName)}`,
    `・生年月日: ${formatProfileValue(self.birthDate)}`,
    `・性別: ${formatProfileValue(self.gender)}`,
    `・MBTI: ${formatProfileValue(self.mbti)}`,
    `・動物占い: ${formatProfileValue(self.animalZodiac)}`,
    `・居住地: ${formatProfileValue(self.residence)}`,
    `・基本価値観: ${formatProfileValue(self.basicValues)}`,
  ];

  return (
    "\n\n【相談者プロフィール】\n" +
    "※ 相談者本人の登録情報。補助情報として参考にし、相談本文より優先しない。\n" +
    lines.join("\n")
  );
}

function buildPartnerImpressionSection(self: ChatSelfProfile): string {
  return (
    "\n\n【相談者から見たパートナー像】\n" +
    "※ 相談者の主観・印象。事実として断定せず、補助情報として扱う。\n" +
    formatProfileValue(self.partnerImpression)
  );
}

function buildPartnerProfileSection(partner: ChatPartnerProfile | null): string {
  const lines = partner
    ? [
        `・名前: ${formatProfileValue(partner.displayName)}`,
        `・生年月日: ${formatProfileValue(partner.birthDate)}`,
        `・MBTI: ${formatProfileValue(partner.mbti)}`,
        `・動物占い: ${formatProfileValue(partner.animalZodiac)}`,
        `・居住地: ${formatProfileValue(partner.residence)}`,
        `・基本価値観: ${formatProfileValue(partner.basicValues)}`,
        `・性別: ${formatProfileValue(partner.gender)}`,
        `・生まれ年: ${formatProfileValue(partner.birthYear)}`,
        `・コミュニケーション傾向: ${formatProfileValue(partner.communicationStyle)}`,
        `・安心しやすい言葉: ${formatProfileValue(partner.comfortablePhrases)}`,
        `・言われると傷つく言葉: ${formatProfileValue(partner.avoidPhrases)}`,
        `・その他メモ: ${formatProfileValue(partner.notes)}`,
      ]
    : [
        "・名前: 未設定",
        "・生年月日: 未設定",
        "・MBTI: 未設定",
        "・動物占い: 未設定",
        "・居住地: 未設定",
        "・基本価値観: 未設定",
        "・性別: 未設定",
        "・生まれ年: 未設定",
        "・コミュニケーション傾向: 未設定",
        "・安心しやすい言葉: 未設定",
        "・言われると傷つく言葉: 未設定",
        "・その他メモ: 未設定",
      ];

  return (
    "\n\n【パートナープロフィール】\n" +
    "※ パートナーの登録情報。引き出し質問の参考にするが、「パートナーはこう言っていた」とは言わない。\n" +
    lines.join("\n")
  );
}

function formatScoreValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "未設定";
  return String(value);
}

function buildDailyQuestionSection(rounds: DailyQuestionRoundDetail[]): string {
  if (rounds.length === 0) return "";

  const blocks = rounds.map((round, index) => {
    const lines = [
      `質問: ${round.question}`,
      `自分の回答: ${round.myAnswer}`,
      `パートナーの回答: ${round.partnerAnswer}`,
      `自分の予想: ${round.myGuess}`,
      `パートナーの予想: ${round.partnerGuess}`,
      `理解度（自分→パートナー）: ${formatScoreValue(round.understanding?.myScore)}`,
      `理解度（パートナー→自分）: ${formatScoreValue(round.understanding?.partnerScore)}`,
      `理解度（ふたり）: ${formatScoreValue(round.understanding?.coupleScore)}`,
    ];

    return `--- ${index + 1} ---\n${lines.join("\n")}`;
  });

  return (
    "\n\n【最近のふたり質問（直近" +
    rounds.length +
    "件）】\n" +
    "※ 開示済みのふたり質問。補助情報として参考にし、相談本文より優先しない。\n" +
    blocks.join("\n\n")
  );
}

export function buildChatInstructions(
  profileContext: ChatProfileContext,
  partnerInsights: PartnerInsightRow[],
  consultationTitle: string | null,
  dailyQuestionRounds: DailyQuestionRoundDetail[] = []
): string {
  let instructions = BASE_INSTRUCTIONS + PROFILE_GUIDANCE;

  instructions += buildSelfProfileSection(profileContext.self);
  instructions += buildPartnerImpressionSection(profileContext.self);
  instructions += buildPartnerProfileSection(profileContext.partner);

  if (dailyQuestionRounds.length > 0) {
    instructions += DAILY_QUESTION_GUIDANCE;
    instructions += buildDailyQuestionSection(dailyQuestionRounds);
  }

  if (consultationTitle) {
    instructions += `\n\n【この相談スレッドのテーマ】\n${consultationTitle}\n※ 会話の文脈が不明な場合も、このテーマに沿った返答をしてください。`;
  }

  if (partnerInsights.length > 0) {
    const insightLines = partnerInsights.map((i) => `・${decryptHintBody(i)}`);
    instructions +=
      "\n\n【パートナーの最近の傾向（最新順）】\n" +
      "※ 必ず守ること：「パートナーがこう言っていた」「相手がこう話していた」という表現は絶対に使わない。" +
      "以下のヒントをさりげなくアドバイスに活かすだけにすること。\n" +
      insightLines.join("\n");
  }

  return instructions;
}
