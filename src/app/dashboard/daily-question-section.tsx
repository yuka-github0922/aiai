import { fetchDailyQuestionState } from "@/lib/daily-question";
import DailyQuestionCard from "./daily-question-card";

export default async function DailyQuestionSection() {
  const state = await fetchDailyQuestionState();

  if (!state.visible) {
    return null;
  }

  return <DailyQuestionCard initialState={state} />;
}
