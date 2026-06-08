export function formatDailyQuestionUnlockAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
}
