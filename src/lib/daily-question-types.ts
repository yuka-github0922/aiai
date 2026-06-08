export const DAILY_QUESTION_MAX_LENGTH = 80;

export type DailyQuestionPhase =
  | "needs_my_answer"
  | "needs_my_guess"
  | "waiting_partner"
  | "revealed";

export type DailyQuestionHidden = {
  visible: false;
};

export type DailyQuestionVisible = {
  visible: true;
  phase: DailyQuestionPhase;
  question: string;
  roundId: string;
  myAnswer?: string;
  myGuess?: string;
  partnerAnswer?: string;
  partnerGuess?: string;
  revealedAt?: string;
};

export type DailyQuestionState = DailyQuestionHidden | DailyQuestionVisible;

export type DailyQuestionRpcState = {
  visible?: boolean;
  phase?: DailyQuestionPhase;
  question?: string;
  round_id?: string;
  my_answer?: string;
  my_guess?: string;
  partner_answer?: string;
  partner_guess?: string;
  revealed_at?: string;
};

export type DailyQuestionRoundDetail = {
  question: string;
  roundId: string;
  myAnswer: string;
  myGuess: string;
  partnerAnswer: string;
  partnerGuess: string;
  revealedAt: string;
};

export type DailyQuestionRoundDetailRpc = {
  error?: string;
  question?: string;
  round_id?: string;
  my_answer?: string;
  my_guess?: string;
  partner_answer?: string;
  partner_guess?: string;
  revealed_at?: string;
};

export function parseDailyQuestionRoundDetail(
  raw: DailyQuestionRoundDetailRpc | null
): DailyQuestionRoundDetail | null {
  if (
    !raw ||
    raw.error ||
    !raw.question ||
    !raw.round_id ||
    !raw.my_answer ||
    !raw.my_guess ||
    !raw.partner_answer ||
    !raw.partner_guess ||
    !raw.revealed_at
  ) {
    return null;
  }

  return {
    question: raw.question,
    roundId: raw.round_id,
    myAnswer: raw.my_answer,
    myGuess: raw.my_guess,
    partnerAnswer: raw.partner_answer,
    partnerGuess: raw.partner_guess,
    revealedAt: raw.revealed_at,
  };
}

export function parseDailyQuestionState(
  raw: DailyQuestionRpcState | null
): DailyQuestionState {
  if (!raw?.visible) {
    return { visible: false };
  }

  if (!raw.phase || !raw.question || !raw.round_id) {
    return { visible: false };
  }

  const state: DailyQuestionVisible = {
    visible: true,
    phase: raw.phase,
    question: raw.question,
    roundId: raw.round_id,
  };

  if (raw.my_answer) {
    state.myAnswer = raw.my_answer;
  }

  if (raw.phase === "revealed") {
    state.myGuess = raw.my_guess;
    state.partnerAnswer = raw.partner_answer;
    state.partnerGuess = raw.partner_guess;
    state.revealedAt = raw.revealed_at;
  }

  return state;
}
