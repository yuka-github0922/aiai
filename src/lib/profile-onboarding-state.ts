import {
  PROFILE_ONBOARDING_FIELD_KEYS,
  PROFILE_ONBOARDING_TOTAL,
  type ProfileOnboardingData,
  type ProfileOnboardingFieldKey,
  type ProfileOnboardingProgress,
} from "./profile-onboarding-types";

const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function hasAnswer(
  key: ProfileOnboardingFieldKey,
  data: ProfileOnboardingData
): boolean {
  switch (key) {
    case "display_name":
      return !!data.displayName?.trim();
    case "partner_nickname":
      return !!data.partnerNickname?.trim();
    case "birth_date":
      return !!data.birthDate;
    case "gender":
      return !!data.gender?.trim();
    case "residence":
      return !!data.residence?.trim();
    case "mbti":
      return !!data.mbti?.trim();
    case "animal_zodiac":
      return !!data.animalZodiac?.trim();
    case "basic_values":
      return !!data.basicValues?.trim();
    case "communication_style":
      return !!data.communicationStyle?.trim();
    case "comfortable_phrases":
      return !!data.comfortablePhrases?.trim();
    case "avoid_phrases":
      return !!data.avoidPhrases?.trim();
    case "notes":
      return !!data.notes?.trim();
    case "partner_impression":
      return !!data.partnerImpression?.trim();
    case "anniversary":
      return data.hasAnniversary;
    default:
      return false;
  }
}

export function isFieldSkipped(
  key: ProfileOnboardingFieldKey,
  skipped: string[]
): boolean {
  return skipped.includes(key);
}

export function isFieldFinished(
  key: ProfileOnboardingFieldKey,
  data: ProfileOnboardingData
): boolean {
  return hasAnswer(key, data) || isFieldSkipped(key, data.skipped);
}

/** 初回ウィザードで次に進む質問（このセッションで通過済みを除く） */
export function getNextWizardField(
  passedKeys: ReadonlySet<ProfileOnboardingFieldKey>
): ProfileOnboardingFieldKey | null {
  for (const key of PROFILE_ONBOARDING_FIELD_KEYS) {
    if (!passedKeys.has(key)) {
      return key;
    }
  }
  return null;
}

/** ウィザードで1つ前の質問 */
export function getPreviousWizardField(
  key: ProfileOnboardingFieldKey
): ProfileOnboardingFieldKey | null {
  const index = PROFILE_ONBOARDING_FIELD_KEYS.indexOf(key);
  if (index <= 0) return null;
  return PROFILE_ONBOARDING_FIELD_KEYS[index - 1];
}

/** 再開時：指定の次以降で未回答の質問 */
export function getNextUnansweredAfter(
  data: ProfileOnboardingData,
  afterKey: ProfileOnboardingFieldKey | null
): ProfileOnboardingFieldKey | null {
  const startIdx =
    afterKey === null
      ? 0
      : PROFILE_ONBOARDING_FIELD_KEYS.indexOf(afterKey) + 1;

  for (let i = startIdx; i < PROFILE_ONBOARDING_FIELD_KEYS.length; i++) {
    const key = PROFILE_ONBOARDING_FIELD_KEYS[i];
    if (!hasAnswer(key, data)) {
      return key;
    }
  }
  return null;
}

/** 未回答の質問（カードから再開するとき） */
export function getNextUnansweredField(
  data: ProfileOnboardingData
): ProfileOnboardingFieldKey | null {
  for (const key of PROFILE_ONBOARDING_FIELD_KEYS) {
    if (!hasAnswer(key, data)) {
      return key;
    }
  }
  return null;
}

export type ModalSessionProgress = {
  total: number;
  answeredCount: number;
  skippedCount: number;
  passedCount: number;
};

export function buildModalSessionProgress(
  sessionAnswered: ReadonlySet<ProfileOnboardingFieldKey>,
  sessionSkipped: ReadonlySet<ProfileOnboardingFieldKey>
): ModalSessionProgress {
  return {
    total: PROFILE_ONBOARDING_TOTAL,
    answeredCount: sessionAnswered.size,
    skippedCount: sessionSkipped.size,
    passedCount: sessionAnswered.size + sessionSkipped.size,
  };
}

export function modalSessionProgressLabel(
  progress: ModalSessionProgress
): { primary: string; secondary: string | null } {
  const primary = `${progress.answeredCount} / ${progress.total} 問 回答済み`;
  const secondary =
    progress.skippedCount > 0 ? `${progress.skippedCount}問スキップ` : null;
  return { primary, secondary };
}

export function modalSessionBarPercent(progress: ModalSessionProgress): number {
  return Math.round((progress.passedCount / progress.total) * 100);
}

export function countProfileOnboardingAnswered(
  data: ProfileOnboardingData
): number {
  return PROFILE_ONBOARDING_FIELD_KEYS.filter((key) => hasAnswer(key, data))
    .length;
}

export function countProfileOnboardingSkipped(
  data: ProfileOnboardingData
): number {
  return PROFILE_ONBOARDING_FIELD_KEYS.filter((key) =>
    isFieldSkipped(key, data.skipped)
  ).length;
}

export function buildProfileOnboardingProgress(
  data: ProfileOnboardingData,
  hasPartner: boolean
): ProfileOnboardingProgress {
  const answeredCount = countProfileOnboardingAnswered(data);
  const skippedCount = countProfileOnboardingSkipped(data);
  const wizardFinishedCount = PROFILE_ONBOARDING_FIELD_KEYS.filter((key) =>
    isFieldFinished(key, data)
  ).length;
  const nextField = getNextUnansweredField(data);

  // プロフィールが全部埋まったときだけ非表示（スキップだけでは完了にしない）
  const isComplete = answeredCount >= PROFILE_ONBOARDING_TOTAL;

  const dismissedRecently =
    !!data.dismissedAt &&
    Date.now() - new Date(data.dismissedAt).getTime() < DISMISS_COOLDOWN_MS;

  // 未完了ならホーム再訪時にモーダル表示（「あとで」押下後24hは除く）
  const shouldAutoOpen = hasPartner && !isComplete && !dismissedRecently;

  return {
    total: PROFILE_ONBOARDING_TOTAL,
    answeredCount,
    skippedCount,
    finishedCount: wizardFinishedCount,
    isComplete,
    shouldAutoOpen,
    shouldShowCard: hasPartner && !isComplete,
    nextField,
  };
}

export function getWizardQuestionIndex(
  key: ProfileOnboardingFieldKey
): number {
  const index = PROFILE_ONBOARDING_FIELD_KEYS.indexOf(key);
  return index < 0 ? 1 : index + 1;
}

function skippedProgressSecondary(skippedCount: number): string | null {
  if (skippedCount <= 0) return null;
  return `うち${skippedCount}問は後で回答`;
}

export function profileOnboardingProgressLabel(
  progress: ProfileOnboardingProgress
): { primary: string; secondary: string | null } {
  const primary = `${progress.answeredCount} / ${progress.total} 問 登録済み`;
  return {
    primary,
    secondary: skippedProgressSecondary(progress.skippedCount),
  };
}

export function profileOnboardingWizardProgressLabel(
  progress: ProfileOnboardingProgress,
  currentKey: ProfileOnboardingFieldKey
): { primary: string; secondary: string | null } {
  const index = getWizardQuestionIndex(currentKey);
  const primary = `${index} / ${progress.total} 問目`;
  const secondary =
    progress.answeredCount > 0 || progress.skippedCount > 0
      ? [
          progress.answeredCount > 0
            ? `登録済み ${progress.answeredCount}問`
            : null,
          skippedProgressSecondary(progress.skippedCount),
        ]
          .filter(Boolean)
          .join(" · ")
      : null;
  return { primary, secondary: secondary || null };
}

export function profileOnboardingBarPercent(
  progress: ProfileOnboardingProgress
): number {
  return Math.round((progress.answeredCount / progress.total) * 100);
}

export function profileOnboardingWizardBarPercent(
  currentKey: ProfileOnboardingFieldKey,
  total: number = PROFILE_ONBOARDING_TOTAL
): number {
  return Math.round((getWizardQuestionIndex(currentKey) / total) * 100);
}
