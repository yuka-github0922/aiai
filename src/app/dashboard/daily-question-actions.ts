"use server";

import { revalidatePath } from "next/cache";
import { attachUnderstandingToState } from "@/lib/daily-question-score-service";
import { createClient } from "@/lib/supabase/server";
import {
  DAILY_QUESTION_MAX_LENGTH,
  parseDailyQuestionState,
  type DailyQuestionState,
} from "@/lib/daily-question-types";

function mapDailyQuestionRpcError(
  message: string | undefined,
  fallback = "送信に失敗しました。もう一度お試しください。"
): string {
  if (!message) return fallback;
  if (message.includes("next question not unlocked yet")) {
    return "次の質問は20:00以降に届きます";
  }
  if (message.includes("advance required before new answer")) {
    return "先に「次の質問へ」を押してください";
  }
  return fallback;
}

function validateText(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label}を入力してください`;
  if (trimmed.length > DAILY_QUESTION_MAX_LENGTH) {
    return `${label}は${DAILY_QUESTION_MAX_LENGTH}文字以内で入力してください`;
  }
  return null;
}

async function submitRpc(
  fn: "submit_daily_question_answer" | "submit_daily_question_guess",
  param: string
): Promise<{ state: DailyQuestionState | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, {
    [fn === "submit_daily_question_answer" ? "p_answer" : "p_guess"]: param,
  });

  if (error) {
    console.error(`${fn} error:`, error);
    return { state: null, error: mapDailyQuestionRpcError(error.message) };
  }

  revalidatePath("/home");
  const state = await attachUnderstandingToState(parseDailyQuestionState(data));
  return { state, error: null };
}

export async function submitDailyQuestionAnswer(
  answer: string
): Promise<{ state: DailyQuestionState | null; error: string | null }> {
  const validationError = validateText(answer, "回答");
  if (validationError) return { state: null, error: validationError };
  return submitRpc("submit_daily_question_answer", answer.trim());
}

export async function submitDailyQuestionGuess(
  guess: string
): Promise<{ state: DailyQuestionState | null; error: string | null }> {
  const validationError = validateText(guess, "予想");
  if (validationError) return { state: null, error: validationError };
  return submitRpc("submit_daily_question_guess", guess.trim());
}

export async function advanceDailyQuestionForUser(): Promise<{
  state: DailyQuestionState | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("advance_daily_question_for_user");

  if (error) {
    console.error("advance_daily_question_for_user error:", error);
    return {
      state: null,
      error: mapDailyQuestionRpcError(
        error.message,
        "進行に失敗しました。もう一度お試しください。"
      ),
    };
  }

  revalidatePath("/home");
  const state = await attachUnderstandingToState(parseDailyQuestionState(data));
  return { state, error: null };
}
