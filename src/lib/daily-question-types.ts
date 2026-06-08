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
