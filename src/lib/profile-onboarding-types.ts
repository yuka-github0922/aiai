export const PROFILE_ONBOARDING_FIELD_KEYS = [
  "display_name",
  "partner_nickname",
  "birth_date",
  "residence",
  "mbti",
  "animal_zodiac",
  "basic_values",
  "communication_style",
  "comfortable_phrases",
  "avoid_phrases",
  "notes",
  "partner_impression",
  "anniversary",
] as const;

export type ProfileOnboardingFieldKey =
  (typeof PROFILE_ONBOARDING_FIELD_KEYS)[number];

export const PROFILE_ONBOARDING_TOTAL = PROFILE_ONBOARDING_FIELD_KEYS.length;

export type ProfileOnboardingInputType =
  | "text"
  | "date"
  | "mbti"
  | "textarea"
  | "anniversary";

export type ProfileOnboardingQuestion = {
  key: ProfileOnboardingFieldKey;
  prompt: string;
  hint: string;
  placeholder: string;
  inputType: ProfileOnboardingInputType;
  privateNote?: string;
};

export type ProfileOnboardingData = {
  displayName: string | null;
  partnerNickname: string | null;
  birthDate: string | null;
  residence: string | null;
  mbti: string | null;
  animalZodiac: string | null;
  basicValues: string | null;
  communicationStyle: string | null;
  comfortablePhrases: string | null;
  avoidPhrases: string | null;
  notes: string | null;
  partnerImpression: string | null;
  hasAnniversary: boolean;
  skipped: string[];
  completedAt: string | null;
  dismissedAt: string | null;
};

export type ProfileOnboardingProgress = {
  total: number;
  answeredCount: number;
  skippedCount: number;
  finishedCount: number;
  isComplete: boolean;
  shouldAutoOpen: boolean;
  shouldShowCard: boolean;
  nextField: ProfileOnboardingFieldKey | null;
};
