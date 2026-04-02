export type SupportedLanguage = 'en-gb' | 'en-us' | 'fr' | 'de' | 'es' | 'zh' | 'it' | 'ja' | 'pt';

export interface LanguageOption {
  value: SupportedLanguage;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { value: 'en-gb', label: 'English (UK)' },
  { value: 'en-us', label: 'English (US)' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'zh', label: '中文' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'pt', label: 'Português' },
];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en-gb';

export function normalizeLanguage(input: string | null | undefined): SupportedLanguage {
  if (!input) return DEFAULT_LANGUAGE;

  const value = input.trim().toLowerCase();

  // Exact match
  if (['en-gb', 'en-us', 'fr', 'de', 'es', 'zh', 'it', 'ja', 'pt'].includes(value)) {
    return value as SupportedLanguage;
  }

  // Legacy 'en' fallback
  if (value === 'en' || value.startsWith('en')) {
    return 'en-gb';
  }

  // Prefix matching for locale variants
  if (value.startsWith('fr')) return 'fr';
  if (value.startsWith('de')) return 'de';
  if (value.startsWith('es')) return 'es';
  if (value.startsWith('zh')) return 'zh';
  if (value.startsWith('it')) return 'it';
  if (value.startsWith('ja')) return 'ja';
  if (value.startsWith('pt')) return 'pt';

  return DEFAULT_LANGUAGE;
}
