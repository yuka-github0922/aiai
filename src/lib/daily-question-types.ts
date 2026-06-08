import {
  getUnderstandingMessage,
  type DailyQuestionScore,
} from "@/lib/daily-question-score";

export const DAILY_QUESTION_MAX_LENGTH = 80;

export type DailyQuestionPhase =
  | "needs_my_answer"
  | "needs_my_guess"
  | "waiting_partner"
  | "revealed"
  | "all_completed";

export type DailyQuestionHidden = {
  visible: false;
};

export type DailyQuestionVisible = {
  visible: true;
  phase: DailyQuestionPhase;
  question: string;
  roundId: string | null;
  canAdvance?: boolean;
  myAnswer?: string;
  myGuess?: string;
  partnerAnswer?: string;
  partnerGuess?: string;
  revealedAt?: string;
  understanding?: DailyQuestionScore;
};

export type DailyQuestionState = DailyQuestionHidden | DailyQuestionVisible;

export type DailyQuestionRpcState = {
  visible?: boolean;
  phase?: DailyQuestionPhase;
  question?: string;
  round_id?: string | null;
  can_advance?: boolean;
  my_answer?: string;
  my_guess?: string;
  partner_answer?: string;
  partner_guess?: string;
  revealed_at?: string;
  understanding_my_score?: number;
  understanding_partner_score?: number;
  understanding_couple_score?: number;
  understanding_model?: string;
};

export type DailyQuestionRoundDetail = {
  question: string;
  roundId: string;
  myAnswer: string;
  myGuess: string;
  partnerAnswer: string;
  partnerGuess: string;
  revealedAt: string;
  understanding?: DailyQuestionScore;
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
  understanding_my_score?: number | null;
  understanding_partner_score?: number | null;
  understanding_couple_score?: number | null;
  understanding_model?: string | null;
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

  const detail: DailyQuestionRoundDetail = {
    question: raw.question,
    roundId: raw.round_id,
    myAnswer: raw.my_answer,
    myGuess: raw.my_guess,
    partnerAnswer: raw.partner_answer,
    partnerGuess: raw.partner_guess,
    revealedAt: raw.revealed_at,
  };

  if (
    raw.understanding_couple_score !== null &&
    raw.understanding_couple_score !== undefined &&
    raw.understanding_my_score !== null &&
    raw.understanding_my_score !== undefined &&
    raw.understanding_partner_score !== null &&
    raw.understanding_partner_score !== undefined
  ) {
    detail.understanding = {
      coupleScore: raw.understanding_couple_score,
      myScore: raw.understanding_my_score,
      partnerScore: raw.understanding_partner_score,
      message: getUnderstandingMessage(raw.understanding_couple_score),
    };
  }

  return detail;
}

function buildUnderstandingFromRpc(
  raw: DailyQuestionRpcState
): DailyQuestionScore | undefined {
  if (
    raw.understanding_couple_score === undefined ||
    raw.understanding_my_score === undefined ||
    raw.understanding_partner_score === undefined
  ) {
    return undefined;
  }

  return {
    coupleScore: raw.understanding_couple_score,
    myScore: raw.understanding_my_score,
    partnerScore: raw.understanding_partner_score,
    message: getUnderstandingMessage(raw.understanding_couple_score),
  };
}

export function parseDailyQuestionState(
  raw: DailyQuestionRpcState | null
): DailyQuestionState {
  if (!raw?.visible || !raw.phase) {
    return { visible: false };
  }

  if (raw.phase === "all_completed") {
    return {
      visible: true,
      phase: "all_completed",
      question: raw.question ?? "",
      roundId: raw.round_id ?? null,
      canAdvance: false,
    };
  }

  if (!raw.question) {
    return { visible: false };
  }

  const state: DailyQuestionVisible = {
    visible: true,
    phase: raw.phase,
    question: raw.question,
    roundId: raw.round_id ?? null,
    canAdvance: raw.can_advance === true,
  };

  if (raw.my_answer) {
    state.myAnswer = raw.my_answer;
  }

  if (raw.phase === "revealed") {
    state.myGuess = raw.my_guess;
    state.partnerAnswer = raw.partner_answer;
    state.partnerGuess = raw.partner_guess;
    state.revealedAt = raw.revealed_at;
    const understanding = buildUnderstandingFromRpc(raw);
    if (understanding) {
      state.understanding = understanding;
    }
  }

  return state;
}
