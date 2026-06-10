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
 * recentNotices は将来 partner_memos / relationship_insights / 相談履歴から生成。
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
    ? [
        {
          emoji: "💬",
          label: "最近は気持ちを確認したい話題が増えている",
        },
        {
          emoji: "🏠",
          label: "住まいについて具体的な話が増えている",
        },
        {
          emoji: "🐶",
          label: "小春の話になると前向きな会話が多い",
        },
      ]
    : [
        {
          emoji: "♡",
          label: "相談を重ねると、最近の変化がここに現れるよ",
        },
      ];

  return { traits, recentNotices };
}
