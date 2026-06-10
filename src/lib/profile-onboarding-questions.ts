import type {
  ProfileOnboardingFieldKey,
  ProfileOnboardingQuestion,
} from "./profile-onboarding-types";

export const GENDER_OPTIONS = [
  "男性",
  "女性",
  "ノンバイナリー",
  "回答しない",
] as const;

export const MBTI_OPTIONS = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
] as const;

export const PROFILE_ONBOARDING_QUESTIONS: ProfileOnboardingQuestion[] = [
  {
    key: "display_name",
    prompt: "まず教えて。AiAiはあなたのことを、何て呼べばいい？",
    hint: "ニックネームでも本名でも大丈夫だよ",
    placeholder: "例：ゆか、たけし",
    inputType: "text",
  },
  {
    key: "partner_nickname",
    prompt: "パートナーのことは、いつも何て呼んでる？",
    hint: "ふたりだけの呼び名でOK",
    placeholder: "例：たけちゃん、ゆい",
    inputType: "text",
  },
  {
    key: "gender",
    prompt: "性別を教えてくれる？",
    hint: "答えたくなければスキップでOK",
    placeholder: "",
    inputType: "gender",
  },
  {
    key: "birth_date",
    prompt: "生年月日を教えてくれる？",
    hint: "誕生日のお祝いや、これからの相性診断にも使うよ",
    placeholder: "",
    inputType: "date",
  },
  {
    key: "residence",
    prompt: "今はどこらへんに住んでる？",
    hint: "都道府県だけでも、ざっくりでも大丈夫",
    placeholder: "例：東京、大阪の郊外",
    inputType: "text",
  },
  {
    key: "mbti",
    prompt: "MBTIって、わかる？",
    hint: "わからなければスキップでOK。ざっくりで大丈夫",
    placeholder: "",
    inputType: "mbti",
  },
  {
    key: "animal_zodiac",
    prompt: "動物占いの結果、わかる？",
    hint: "知ってる人だけでOK。例：束縛を嫌う黒豹",
    placeholder: "例：穏やかな狼",
    inputType: "text",
  },
  {
    key: "basic_values",
    prompt: "恋愛や人生で、譲れない価値観ってある？",
    hint: "「正直でいたい」「自由を大事にしたい」みたいな言葉でOK",
    placeholder: "例：約束は守りたい。でもお互いの時間も大切にしたい",
    inputType: "textarea",
  },
  {
    key: "communication_style",
    prompt: "話すとき、どんなタイプかな？",
    hint: "論理的に話す、気持ちを先に出す…なんでもいいよ",
    placeholder: "例：気持ちを先に伝えてから、理由を説明するタイプ",
    inputType: "textarea",
  },
  {
    key: "comfortable_phrases",
    prompt: "どんな言葉をもらうと、ほっとする？",
    hint: "パートナーに言われると嬉しい・安心するフレーズ",
    placeholder: "例：「ありがとう」「頑張ったね」「大丈夫だよ」",
    inputType: "textarea",
  },
  {
    key: "avoid_phrases",
    prompt: "逆に、言われるとちょっと傷つきやすい言葉は？",
    hint: "責められてる気になる言い方など、ざっくりで大丈夫",
    placeholder: "例：「でも」「いつもそう」「仕方ないよ」",
    inputType: "textarea",
  },
  {
    key: "notes",
    prompt: "他に、伝えておきたいことはある？",
    hint: "疲れたときは一人になりたい、など小さなことでも◎",
    placeholder: "例：仕事が忙しい週は、返信が遅くなるかも",
    inputType: "textarea",
  },
  {
    key: "partner_impression",
    prompt: "パートナーって、どんな人に見える？",
    hint: "あなたから見た印象を教えて。相談がもっと的確になるよ",
    placeholder: "例：慎重だけど、一度決めたら本気。休日はゆっくり派",
    inputType: "textarea",
    privateNote: "この回答はあなただけが見られます",
  },
  {
    key: "anniversary",
    prompt: "ふたりにとって、大切な日はある？",
    hint: "付き合った日、初デートの日…1つだけでも登録できるよ",
    placeholder: "例：付き合った日",
    inputType: "anniversary",
  },
];

export function getProfileOnboardingQuestion(
  key: ProfileOnboardingFieldKey
): ProfileOnboardingQuestion {
  const question = PROFILE_ONBOARDING_QUESTIONS.find((q) => q.key === key);
  if (!question) {
    throw new Error(`Unknown onboarding field: ${key}`);
  }
  return question;
}
