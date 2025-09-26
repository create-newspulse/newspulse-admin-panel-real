export interface LanguageOption {
  name: string;
  code: string;
  label: string;
}

export const supportedLanguages: LanguageOption[] = [
  {
    name: "English",
    code: "en",
    label: "US English (English)",
  },
  {
    name: "Gujarati",
    code: "gu",
    label: "IN ગુજરાતી (Gujarati)",
  },
  {
    name: "Hindi",
    code: "hi",
    label: "IN हिंदी (Hindi)",
  },
];
