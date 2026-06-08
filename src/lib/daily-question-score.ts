export type UnderstandingScoreInput = {
  myGuess: string;
  myAnswer: string;
  partnerGuess: string;
  partnerAnswer: string;
};

/** 1ラウンド分の理解度スコア（将来の集計・グラフで再利用） */
export type DailyQuestionScore = {
  coupleScore: number;
  myScore: number;
  partnerScore: number;
  message: string;
};

/** @deprecated DailyQuestionScore を使用してください */
export type UnderstandingScoreResult = DailyQuestionScore;

/** 将来 OpenAI 意味類似度に差し替えやすいよう正規化を分離 */
export function normalizeForScore(text: string): string {
  return text
    .trim()
    .replace(/\u3000/g, "")
    .replace(/[？?！!。、,.「」『』【】\s]/g, "")
    .toLowerCase();
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

/**
 * 予想と回答の近さを 0〜100 で返す（ルールベース MVP）。
 * 将来はこの関数を OpenAI 意味類似度判定に差し替え可能。
 */
export function scoreGuessAgainstAnswer(guess: string, answer: string): number {
  const normalizedGuess = normalizeForScore(guess);
  const normalizedAnswer = normalizeForScore(answer);

  if (!normalizedAnswer || !normalizedGuess) return 0;
  if (normalizedGuess === normalizedAnswer) return 100;
  if (
    normalizedGuess.includes(normalizedAnswer) ||
    normalizedAnswer.includes(normalizedGuess)
  ) {
    return 85;
  }

  const maxLen = Math.max(normalizedGuess.length, normalizedAnswer.length);
  const distance = levenshteinDistance(normalizedGuess, normalizedAnswer);
  const similarity = 1 - distance / maxLen;
  const raw = Math.round(similarity * 100);

  return Math.min(95, Math.max(15, raw));
}

export function getUnderstandingMessage(coupleScore: number): string {
  if (coupleScore >= 80) return "かなり近い予想でした";
  if (coupleScore >= 50) return "少し近いところがありました";
  return "違いが見えたね。相手のことを知るきっかけになりました";
}

export function computeCoupleScore(
  myScore: number,
  partnerScore: number
): number {
  return Math.round((myScore + partnerScore) / 2);
}

/** 複数ラウンドから平均理解度を算出（将来の統計画面用） */
export function averageCoupleScore(scores: DailyQuestionScore[]): number | null {
  if (scores.length === 0) return null;
  const total = scores.reduce((sum, score) => sum + score.coupleScore, 0);
  return Math.round(total / scores.length);
}

/** 複数ラウンドから最高理解度を算出（将来の統計画面用） */
export function maxCoupleScore(scores: DailyQuestionScore[]): number | null {
  if (scores.length === 0) return null;
  return Math.max(...scores.map((score) => score.coupleScore));
}

/** ルールベース fallback（OpenAI 失敗時のみ server から使用） */
export function computeUnderstandingScoreFallback(
  input: UnderstandingScoreInput
): DailyQuestionScore {
  const myScore = scoreGuessAgainstAnswer(input.myGuess, input.partnerAnswer);
  const partnerScore = scoreGuessAgainstAnswer(
    input.partnerGuess,
    input.myAnswer
  );
  const coupleScore = computeCoupleScore(myScore, partnerScore);

  return {
    coupleScore,
    myScore,
    partnerScore,
    message: getUnderstandingMessage(coupleScore),
  };
}

/** @deprecated computeUnderstandingScoreFallback を使用してください */
export const computeUnderstandingScore = computeUnderstandingScoreFallback;
