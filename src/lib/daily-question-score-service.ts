import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  computeCoupleScore,
  computeUnderstandingScoreFallback,
  getUnderstandingMessage,
  type DailyQuestionScore,
  type UnderstandingScoreInput,
} from "@/lib/daily-question-score";
import { scoreUnderstandingWithOpenAI } from "@/lib/daily-question-score-ai";
import type {
  DailyQuestionRoundDetail,
  DailyQuestionState,
  DailyQuestionVisible,
} from "@/lib/daily-question-types";

const FALLBACK_MODEL = "fallback";

type RoundScoreRow = {
  understanding_my_score: number | null;
  understanding_partner_score: number | null;
  understanding_couple_score: number | null;
  understanding_model: string | null;
  understanding_scored_at: string | null;
};

export type EnsureUnderstandingInput = UnderstandingScoreInput & {
  roundId: string;
  question: string;
};

function rowToDailyQuestionScore(row: RoundScoreRow): DailyQuestionScore | null {
  if (
    row.understanding_couple_score === null ||
    row.understanding_my_score === null ||
    row.understanding_partner_score === null
  ) {
    return null;
  }

  return {
    coupleScore: row.understanding_couple_score,
    myScore: row.understanding_my_score,
    partnerScore: row.understanding_partner_score,
    message: getUnderstandingMessage(row.understanding_couple_score),
  };
}

async function loadPersistedScore(
  roundId: string
): Promise<DailyQuestionScore | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_question_rounds")
    .select(
      "understanding_my_score, understanding_partner_score, understanding_couple_score, understanding_model, understanding_scored_at"
    )
    .eq("id", roundId)
    .maybeSingle();

  if (error) {
    console.error("[understanding-score] load error:", error);
    return null;
  }

  if (!data) return null;
  return rowToDailyQuestionScore(data as RoundScoreRow);
}

async function persistScore(
  roundId: string,
  score: DailyQuestionScore,
  model: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("persist_round_understanding_scores", {
    p_round_id: roundId,
    p_my_score: score.myScore,
    p_partner_score: score.partnerScore,
    p_couple_score: score.coupleScore,
    p_model: model,
  });

  if (error) {
    console.error("[understanding-score] persist error:", error);
  }
}

async function computeAndPersistScore(
  input: EnsureUnderstandingInput
): Promise<DailyQuestionScore> {
  let myScore: number;
  let partnerScore: number;
  let model: string;

  try {
    const ai = await scoreUnderstandingWithOpenAI(input.question, input);
    myScore = ai.myScore;
    partnerScore = ai.partnerScore;
    model = ai.model;
  } catch (error) {
    console.error("[understanding-score] OpenAI failed, using fallback:", error);
    const fallback = computeUnderstandingScoreFallback(input);
    myScore = fallback.myScore;
    partnerScore = fallback.partnerScore;
    model = FALLBACK_MODEL;
  }

  const coupleScore = computeCoupleScore(myScore, partnerScore);
  const score: DailyQuestionScore = {
    myScore,
    partnerScore,
    coupleScore,
    message: getUnderstandingMessage(coupleScore),
  };

  await persistScore(input.roundId, score, model);
  const reloaded = await loadPersistedScore(input.roundId);
  return reloaded ?? score;
}

/** revealed round の理解度を DB から取得、未採点なら同期採点して保存 */
export async function ensureRoundUnderstandingScore(
  input: EnsureUnderstandingInput
): Promise<DailyQuestionScore> {
  const existing = await loadPersistedScore(input.roundId);
  if (existing) {
    return existing;
  }

  return computeAndPersistScore(input);
}

function isRevealedScoreReady(state: DailyQuestionVisible): boolean {
  return (
    state.phase === "revealed" &&
    !!state.roundId &&
    !!state.myGuess &&
    !!state.myAnswer &&
    !!state.partnerGuess &&
    !!state.partnerAnswer
  );
}

function attachScoreToState(
  state: DailyQuestionVisible,
  score: DailyQuestionScore
): DailyQuestionVisible {
  return {
    ...state,
    understanding: score,
  };
}

export async function attachUnderstandingToState(
  state: DailyQuestionState
): Promise<DailyQuestionState> {
  if (!state.visible || !isRevealedScoreReady(state)) {
    return state;
  }

  if (state.understanding) {
    if (state.understanding.message) {
      return state;
    }
    return attachScoreToState(state, {
      ...state.understanding,
      message: getUnderstandingMessage(state.understanding.coupleScore),
    });
  }

  const score = await ensureRoundUnderstandingScore({
    roundId: state.roundId!,
    question: state.question,
    myGuess: state.myGuess!,
    myAnswer: state.myAnswer!,
    partnerGuess: state.partnerGuess!,
    partnerAnswer: state.partnerAnswer!,
  });

  return attachScoreToState(state, score);
}

export async function attachUnderstandingToRoundDetail(
  detail: DailyQuestionRoundDetail
): Promise<DailyQuestionRoundDetail> {
  if (detail.understanding?.message) {
    return detail;
  }

  if (detail.understanding) {
    return {
      ...detail,
      understanding: {
        ...detail.understanding,
        message: getUnderstandingMessage(detail.understanding.coupleScore),
      },
    };
  }

  const score = await ensureRoundUnderstandingScore({
    roundId: detail.roundId,
    question: detail.question,
    myGuess: detail.myGuess,
    myAnswer: detail.myAnswer,
    partnerGuess: detail.partnerGuess,
    partnerAnswer: detail.partnerAnswer,
  });

  return { ...detail, understanding: score };
}
