import type { ComponentEditorSettings } from '../SmartComponentEditor';
import type { PitchType } from '@/app/lib/types';
export type RulesDraft = { wasteAmount: string; pitchType: PitchType };
export type RulesErrors = { wasteAmount?: string; pitchType?: string };
export function validateRules(settings: ComponentEditorSettings, draft: RulesDraft, pitchVisible: boolean): RulesErrors {
 const errors: RulesErrors = {};
 if (settings.wasteType !== 'none') {
   const raw = draft.wasteAmount.trim(), n = Number(raw);
   if (!raw || !Number.isFinite(n) || n < 0 || (settings.wasteType === 'percent' && n > 100))
     errors.wasteAmount = settings.wasteType === 'percent' ? 'Enter a percentage between 0 and 100.' : 'Enter an allowance of zero or more.';
 }
 if (settings.pitchEnabled && !pitchVisible) errors.pitchType = 'Pitch is not available for this trade.';
 if (settings.pitchEnabled && !['rafter','valley_hip'].includes(draft.pitchType)) errors.pitchType = 'Choose a pitch rule.';
 return errors;
}
