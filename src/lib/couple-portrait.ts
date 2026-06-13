export type PersonTrait = {
  name: string;
  traits: string[];
  avatarUrl?: string | null;
  isAiGenerated?: boolean;
  /** @deprecated フォールバック表示用。AI生成時は使わない */
  typeLabel?: string;
  /** @deprecated フォールバック表示用。AI生成時は使わない */
  description?: string;
};

/** 観察・変化の発見カード（将来は memos / insights / 相談履歴から生成） */
export type AiRecentNotice = {
  emoji: string;
  label: string;
};

export type CouplePortraitInput = {
  selfName: string;
  partnerName: string;
  hasPartner: boolean;
  mbti: string | null;
  communicationStyle: string | null;
};

export type CouplePortrait = {
  traits: PersonTrait[];
  recentNotices: AiRecentNotice[];
};

/**
 * ふたりタブ用ポートレート（現状はテンプレート）。
 * recentNotices は cached_couple_traits.recent_notices（AI 観察レポート）から供給。
 * ふたりの相談・insights・メモを材料に AI が「最近の変化」として言語化する。
 * 相談内容のベタ書き・ネガティブな一時感情は表示しない。
 */
export function buildCouplePortrait(input: CouplePortraitInput): CouplePortrait {
  const selfTrait: PersonTrait = {
    name: input.selfName,
    traits: [
      "相談を重ねるほど、",
      "ここにあなたらしさが",
      "紹介されていきます。",
    ],
    typeLabel: input.mbti ?? undefined,
    description: input.communicationStyle ?? "感情を重視する",
  };

  const partnerTrait: PersonTrait = {
    name: input.partnerName,
    traits: [
      "ふたりの会話が増えると、",
      "パートナーの紹介も",
      "ここに現れます。",
    ],
    typeLabel: "INFP",
    description: "慎重に考えるタイプ",
  };

  const traits = input.hasPartner ? [selfTrait, partnerTrait] : [selfTrait];

  const recentNotices: AiRecentNotice[] = input.hasPartner
    ? []
    : [
        {
          emoji: "♡",
          label: "相談を重ねると、最近の変化がここに現れるよ",
        },
      ];

  return { traits, recentNotices };
}
