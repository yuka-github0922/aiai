/** OpenAI 不可時・クライアント安全なメモ言い換えヒューリスティック */
export function heuristicMemoUnderstanding(content: string): string | null {
  const text = content.trim();
  if (!text || text === "なし") return null;

  const hasPet = /小春|犬|猫|ペット|わんわん/.test(text);

  if (hasPet && /物件|住める|同棲|マンション|部屋|引っ越/.test(text)) {
    return "小春は家族として大切にしている";
  }
  if (hasPet && /遊園地|行きたい|デート|遊び|公園/.test(text)) {
    return "小春との時間を大切にしたい";
  }
  if (/同棲|住める|物件|引っ越|暮らし/.test(text)) {
    return "同棲について話し合っている";
  }
  if (/行きたい|遊園地|旅行|デート/.test(text)) {
    return "一緒の時間を大切にしたい";
  }
  if (/欲しい|プレゼント|財布|ギフト/.test(text)) {
    return "相手の気持ちを大切にしたい";
  }
  if (/好き|大切|家族/.test(text)) {
    return text.length <= 30 ? text : `${text.slice(0, 29)}…`;
  }

  return text.length <= 30 ? text : `${text.slice(0, 29)}…`;
}
