export type SupportedLanguage = 'en' | 'en-gb' | 'en-us';

export interface LanguageOption {
  value: SupportedLanguage;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { value: 'en', label: 'English' },
  { value: 'en-gb', label: 'English (UK)' },
  { value: 'en-us', label: 'English (US)' },
];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export function normalizeLanguage(input: string | null | undefined): SupportedLanguage {
  if (!input) {
    return DEFAULT_LANGUAGE;
  }

  const value = input.trim().toLowerCase();

  if (value === 'en' || value === 'en-gb' || value === 'en-us') {
    return value;
  }

  if (value.startsWith('en-gb')) {
    return 'en-gb';
  }

  if (value.startsWith('en-us')) {
    return 'en-us';
  }

  if (value.startsWith('en')) {
    return 'en';
  }

  return DEFAULT_LANGUAGE;
}
