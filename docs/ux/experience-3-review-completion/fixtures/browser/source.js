const modules={"app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx":function(require,module,exports){
'use client';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteBuilder = QuoteBuilder;
const jsx_runtime_1 = require("react/jsx-runtime");
const QuoteJourneyContext_1 = require("app/components/quote-entry/QuoteJourneyContext.tsx");
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const component_focus_1 = require("app/lib/smart-assistant/v2/component-focus.ts");
const actions_1 = require("app/(auth)/[workspaceSlug]/quotes/actions.ts");
const labels_1 = require("app/lib/trades/labels.ts");
const engine_1 = require("app/lib/pricing/engine.ts");
// Use the polymorphic helpers for any user-input -> metric conversion. They
// dispatch correctly across all three systems (metric / imperial_ft /
// imperial_rs) so we don't have to branch on the system manually anywhere
// the user types a number into an Imperial quote.
const conversions_1 = require("app/lib/measurements/conversions.ts");
const displayHelpers_1 = require("app/lib/measurements/displayHelpers.ts");
// MeasurementSystemToggle removed: a quote's measurement system is locked at
// creation time and cannot be changed afterwards (see
// QuoteDetailsForm + convertQuoteMeasurementSystem).
const QuoteNameEditor_1 = require("app/(auth)/[workspaceSlug]/quotes/[id]/QuoteNameEditor.tsx");
const ConfirmQuoteButton_1 = require("app/(auth)/[workspaceSlug]/quotes/[id]/ConfirmQuoteButton.tsx");
const CurrencySelector_1 = require("app/(auth)/[workspaceSlug]/quotes/[id]/CurrencySelector.tsx");
const FilesManager_1 = require("app/(auth)/[workspaceSlug]/quotes/[id]/FilesManager.tsx");
const currencies_1 = require("app/lib/currency/currencies.ts");
const ConfirmModal_1 = require("app/components/ConfirmModal.tsx");
const CreateSmartComponentModal_1 = require("app/components/CreateSmartComponentModal.tsx");
// F-15: Extracted sub-components
const RoofAreaCard_1 = require("app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/RoofAreaCard.tsx");
const ExpandableComponent_1 = require("app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx");
const AddFromLibrary_1 = require("app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/AddFromLibrary.tsx");
const ScrollIndicator_1 = require("app/components/ui/ScrollIndicator.tsx");
const QcButton_1 = require("app/components/ui/v2/QcButton.tsx");
const QcField_1 = require("app/components/ui/v2/QcField.tsx");
const QcSurface_1 = require("app/components/ui/v2/QcSurface.tsx");
const QcWorkflowStepper_1 = require("app/components/ui/v2/QcWorkflowStepper.tsx");
const QcMoneySummary_1 = require("app/components/ui/v2/QcMoneySummary.tsx");
const useQcFeedback_1 = require("app/components/ui/v2/useQcFeedback.tsx");
require("app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/quote-builder.css");
function QuoteBuilder({ quote: initialQuote, initialRoofAreas, initialRoofAreaEntries, initialComponents, initialEntries, libraryComponents, workspaceSlug, companyDefaultCurrency, planUrl, planName, supportingFiles, hasExistingTakeoff = false, linesImageUrl = null, planStoragePath = null, allPlans = [], takeoffData: _takeoffData = [], externalPhase, onPhaseChange, isOverStorage, companyMeasurementSystem = 'metric', companyDefaultTrade = 'roofing', collections = [], }) {
    console.log('[QuoteBuilder] Received components:', initialComponents.length, initialComponents.map(c => ({ name: c.name, type: c.component_type })));
    const { notify, feedback } = (0, useQcFeedback_1.useQcFeedback)();
    const newAreaId = (0, react_1.useId)();
    const materialMarginId = (0, react_1.useId)();
    const labourMarginId = (0, react_1.useId)();
    const [internalPhase, setInternalPhase] = (0, react_1.useState)('areas');
    // Use external phase if provided, otherwise use internal
    const phase = externalPhase ?? internalPhase;
    const setPhase = (newPhase) => {
        if (reviewCompleting)
            return;
        if (onPhaseChange) {
            onPhaseChange(newPhase);
        }
        else {
            setInternalPhase(newPhase);
        }
    };
    const [quote, setQuote] = (0, react_1.useState)(initialQuote);
    // Phase 8: trade-aware labels + convenience flag.
    const tradeLabels = (0, labels_1.getTradeLabels)(quote.trade);
    // (2026-07-12) quoteIsGeneric removed: no-area component rendering now
    // applies to ALL trades, since roofing quotes can skip area creation too.
    // Update quote state when props change (e.g., after currency change)
    (0, react_1.useEffect)(() => {
        setQuote(initialQuote);
    }, [initialQuote.currency, initialQuote.measurement_system]);
    // Margin controls state
    const [materialMarginEnabled, setMaterialMarginEnabled] = (0, react_1.useState)(quote.material_margin_enabled ?? true);
    const [laborMarginEnabled, setLaborMarginEnabled] = (0, react_1.useState)(quote.labor_margin_enabled ?? true);
    const [materialMarginPercent, setMaterialMarginPercent] = (0, react_1.useState)((quote.material_margin_percent ?? 0).toString());
    const [laborMarginPercent, setLaborMarginPercent] = (0, react_1.useState)((quote.labor_margin_percent ?? 0).toString());
    const [marginSaving, setMarginSaving] = (0, react_1.useState)(false);
    const [reviewCompleting, setReviewCompleting] = (0, react_1.useState)(false);
    const marginSectionRef = (0, react_1.useRef)(null);
    const [roofAreas, setRoofAreas] = (0, react_1.useState)(initialRoofAreas);
    const [roofAreaEntries, setRoofAreaEntries] = (0, react_1.useState)(initialRoofAreaEntries);
    const [components, setComponents] = (0, react_1.useState)(initialComponents);
    const [entries, setEntries] = (0, react_1.useState)(initialEntries);
    // Assistant navigation only reveals an already-loaded component. It never
    // mutates data or turns a card/navigation event into approval.
    const [assistantFocus, setAssistantFocus] = (0, react_1.useState)(null);
    const focusHandler = (0, react_1.useRef)(() => { });
    focusHandler.current = () => {
        const id = (0, component_focus_1.componentFocusId)(window.location.search);
        const component = components.find(c => c.id === id);
        if (!component)
            return;
        const destinationPhase = component.component_type === 'extra' && roofAreas.length > 0 ? 'extras' : 'components';
        // On a fresh digital route the URL already selected the phase. Do not
        // rewrite its query before the assistant has acknowledged navigation.
        if (phase !== destinationPhase)
            setPhase(destinationPhase);
        setAssistantFocus(previous => ({ id: component.id, request: (previous?.request ?? 0) + 1 }));
    };
    (0, react_1.useEffect)(() => {
        const focus = () => focusHandler.current();
        focus();
        window.addEventListener(component_focus_1.COMPONENT_FOCUS_EVENT, focus);
        window.addEventListener('popstate', focus);
        return () => { window.removeEventListener(component_focus_1.COMPONENT_FOCUS_EVENT, focus); window.removeEventListener('popstate', focus); };
        // Reopening the same card sends an explicit event; ordinary rerenders or
        // manual phase changes must not keep snapping back to this component.
    }, [quote.id]);
    // localLibrary: lifted from prop so newly-created mid-quote components are
    // immediately available for future adds in the same session.
    const [localLibrary, setLocalLibrary] = (0, react_1.useState)(libraryComponents);
    // Mid-quote Smart Component™ creation modal state.
    const [showCreateComponentModal, setShowCreateComponentModal] = (0, react_1.useState)(false);
    const [createCompForAreaId, setCreateCompForAreaId] = (0, react_1.useState)(null);
    const [createCompType, setCreateCompType] = (0, react_1.useState)('main');
    const [newAreaLabel, setNewAreaLabel] = (0, react_1.useState)('');
    const [areaPendingDelete, setAreaPendingDelete] = (0, react_1.useState)(null);
    const [areaDeleting, setAreaDeleting] = (0, react_1.useState)(false);
    // Empty-quote guard: when the user clicks Confirm without any roof areas
    // or main components, we show an explanation modal instead of confirming
    // a hollow quote. Clicking OK bounces them back to the Roof Areas phase.
    const [showEmptyQuoteGuard, setShowEmptyQuoteGuard] = (0, react_1.useState)(null);
    const mainComps = components.filter(c => c.component_type === 'main');
    const extraComps = components.filter(c => c.component_type === 'extra');
    console.log('[QuoteBuilder] Filtered - mainComps:', mainComps.length, 'extraComps:', extraComps.length);
    const totalRoofSqm = roofAreas.reduce((sum, a) => sum + (a.computed_sqm ?? 0), 0);
    // Get effective currency for display
    const effectiveCurrency = (0, currencies_1.getEffectiveCurrency)(quote.currency, companyDefaultCurrency);
    const engineComps = components.map(c => ({
        id: c.id,
        name: c.name,
        componentType: c.component_type,
        measurementType: c.measurement_type,
        inputMode: c.input_mode,
        finalValue: c.final_value ?? undefined,
        calcRawValue: c.calc_raw_value ?? undefined,
        calcPitchDegrees: c.calc_pitch_degrees ?? undefined,
        calcPitchFactor: c.calc_pitch_factor ?? undefined,
        wasteType: c.waste_type,
        wastePercent: c.waste_percent,
        wasteFixed: c.waste_fixed,
        finalQuantity: c.final_quantity ?? undefined,
        materialRate: c.material_rate,
        labourRate: c.labour_rate,
        materialCost: c.material_cost,
        labourCost: c.labour_cost,
        isRateOverridden: c.is_rate_overridden,
        isQuantityOverridden: c.is_quantity_overridden,
        isWasteOverridden: c.is_waste_overridden,
        isPitchOverridden: c.is_pitch_overridden,
        isCustomerVisible: c.is_customer_visible,
        pricingUnit: c.pricing_unit ?? undefined,
    }));
    const totals = (0, engine_1.computeQuoteTotals)(engineComps, {
        materialMarginPct: (quote.material_margin_enabled ?? true)
            ? (quote.material_margin_percent ?? 0)
            : 0,
        labourMarginPct: (quote.labor_margin_enabled ?? true)
            ? (quote.labor_margin_percent ?? 0)
            : 0,
        taxRate: quote.tax_rate
    });
    const allAreasLocked = roofAreas.every(a => a.is_locked);
    async function handleAddArea() {
        if (!newAreaLabel.trim())
            return;
        const created = await (0, actions_1.addQuoteRoofArea)(quote.id, newAreaLabel.trim());
        setRoofAreas(prev => [...prev, created]);
        setRoofAreaEntries(prev => ({ ...prev, [created.id]: [] }));
        setNewAreaLabel('');
    }
    async function handleUpdateArea(id, updates) {
        const updated = await (0, actions_1.updateQuoteRoofArea)(id, updates);
        setRoofAreas(prev => prev.map(a => a.id === id ? updated : a));
        if (updates.calc_pitch_degrees && updates.calc_pitch_degrees > 0 && !quote.global_pitch_degrees) {
            setQuote(prev => ({ ...prev, global_pitch_degrees: updates.calc_pitch_degrees }));
        }
    }
    async function handleToggleLock(id, locked) {
        await (0, actions_1.toggleAreaLock)(id, locked);
        setRoofAreas(prev => prev.map(a => a.id === id ? { ...a, is_locked: locked } : a));
    }
    async function handleAddRoofAreaEntry(areaId, widthInput, lengthInput) {
        const area = roofAreas.find(a => a.id === areaId);
        if (!area)
            return;
        // Convert imperial inputs to metric for storage. linearInputToMetric()
        // is a no-op for metric quotes and converts feet -> meters for both
        // imperial_ft and imperial_rs.
        const widthM = (0, conversions_1.linearInputToMetric)(widthInput, quote.measurement_system);
        const lengthM = (0, conversions_1.linearInputToMetric)(lengthInput, quote.measurement_system);
        const entry = await (0, actions_1.addRoofAreaEntry)(areaId, widthM, lengthM, area.calc_pitch_degrees ?? 0);
        setRoofAreaEntries(prev => ({ ...prev, [areaId]: [...(prev[areaId] ?? []), entry] }));
        const areaEnts = [...(roofAreaEntries[areaId] ?? []), entry];
        const totalSqm = areaEnts.reduce((s, e) => s + Number(e.sqm), 0);
        setRoofAreas(prev => prev.map(a => a.id === areaId ? { ...a, computed_sqm: totalSqm } : a));
    }
    async function handleRemoveRoofAreaEntry(entryId, areaId) {
        await (0, actions_1.removeRoofAreaEntry)(entryId, areaId);
        const updated = (roofAreaEntries[areaId] ?? []).filter(e => e.id !== entryId);
        setRoofAreaEntries(prev => ({ ...prev, [areaId]: updated }));
        const totalSqm = updated.reduce((s, e) => s + Number(e.sqm), 0);
        setRoofAreas(prev => prev.map(a => a.id === areaId ? { ...a, computed_sqm: totalSqm } : a));
    }
    function handleRemoveArea(id) {
        const area = roofAreas.find(a => a.id === id);
        setAreaPendingDelete({ id, label: area?.label || `this ${tradeLabels.areaSingularLabel.toLowerCase()}` });
    }
    async function confirmRemoveArea() {
        if (!areaPendingDelete)
            return;
        setAreaDeleting(true);
        try {
            await (0, actions_1.removeQuoteRoofArea)(areaPendingDelete.id);
            setRoofAreas(prev => prev.filter(a => a.id !== areaPendingDelete.id));
            setComponents(prev => prev.filter(c => c.quote_roof_area_id !== areaPendingDelete.id));
            setAreaPendingDelete(null);
        }
        catch (err) {
            await notify(err instanceof Error ? err.message : `Failed to delete ${tradeLabels.areaSingularLabel.toLowerCase()}`);
        }
        finally {
            setAreaDeleting(false);
        }
    }
    async function handleAddFromLibrary(libId, areaId, type) {
        const lib = localLibrary.find(c => c.id === libId);
        if (!lib)
            return;
        const created = await (0, actions_1.addQuoteComponent)(quote.id, {
            quote_roof_area_id: areaId ?? undefined,
            component_library_id: libId,
            name: lib.name,
            component_type: type,
            measurement_type: lib.measurement_type,
            material_rate: lib.default_material_rate,
            labour_rate: lib.default_labour_rate,
            waste_type: lib.default_waste_type,
            waste_percent: lib.default_waste_percent,
            waste_fixed: lib.default_waste_fixed,
            pitch_type: lib.default_pitch_type,
        });
        setComponents(prev => [...prev, created]);
        setEntries(prev => ({ ...prev, [created.id]: [] }));
    }
    /**
     * Called when a new Smart Component™ is created mid-quote via the modal.
     * Adds to localLibrary (so it’s available for future adds this session)
     * then immediately creates the quote_component row.
     */
    async function handleComponentCreated(comp) {
        setLocalLibrary(prev => [...prev, comp]);
        // Directly create the quote component from the returned library row
        // (avoids relying on the state update being synchronous).
        const created = await (0, actions_1.addQuoteComponent)(quote.id, {
            quote_roof_area_id: createCompForAreaId ?? undefined,
            component_library_id: comp.id,
            name: comp.name,
            component_type: createCompType,
            measurement_type: comp.measurement_type,
            material_rate: comp.default_material_rate,
            labour_rate: comp.default_labour_rate,
            waste_type: comp.default_waste_type,
            waste_percent: comp.default_waste_percent,
            waste_fixed: comp.default_waste_fixed,
            pitch_type: comp.default_pitch_type,
        });
        setComponents(prev => [...prev, created]);
        setEntries(prev => ({ ...prev, [created.id]: [] }));
        setShowCreateComponentModal(false);
    }
    async function handleRemoveComponent(id) {
        await (0, actions_1.removeQuoteComponent)(id);
        setComponents(prev => prev.filter(c => c.id !== id));
        setEntries(prev => {
            const n = { ...prev };
            delete n[id];
            return n;
        });
    }
    async function handleAddEntry(compId, rawInputValue, options) {
        const comp = components.find(c => c.id === compId);
        // Convert imperial inputs to metric for storage. The helpers handle the
        // 3 systems correctly:
        //   - imperial_ft: ft -> m (linear), ft² -> m² (area), ft³ -> m³ (volume)
        //   - imperial_rs: ft -> m (linear), RS  -> m² (area)
        //   - metric:     pass through
        //   - quantity / fixed: pass through (no unit attached)
        let rawValue = rawInputValue;
        const mt = comp?.measurement_type;
        // 'none' = caller already converted to metric; skip auto-conversion.
        const convertAs = options?.convertAs === undefined
            ? (mt === 'area' || mt === 'irregular_area' ? 'area'
                : mt === 'length_x_height' || mt === 'multi_lineal_lxh' ? 'linear'
                    : mt === 'volume' || mt === 'volume_3d' ? 'volume'
                        : mt === 'lineal' || mt === 'linear' || mt === 'multi_lineal' || mt === 'curved_line' ? 'linear'
                            : null)
            : (options?.convertAs === 'none' ? null : options?.convertAs);
        if (convertAs === 'area') {
            rawValue = (0, conversions_1.areaInputToMetric)(rawInputValue, quote.measurement_system);
        }
        else if (convertAs === 'volume') {
            rawValue = (0, conversions_1.volumeInputToMetric)(rawInputValue, quote.measurement_system);
        }
        else if (convertAs === 'linear') {
            rawValue = (0, conversions_1.linearInputToMetric)(rawInputValue, quote.measurement_system);
        }
        const areaPitch = comp?.quote_roof_area_id
            ? roofAreas.find(a => a.id === comp.quote_roof_area_id)?.calc_pitch_degrees ?? null
            : null;
        const entry = await (0, actions_1.addComponentEntry)(compId, rawValue, areaPitch, options);
        const totals = entry.componentTotals;
        setEntries(prev => ({ ...prev, [compId]: [...(prev[compId] ?? []), entry] }));
        setComponents(prev => prev.map(c => c.id === compId ? {
            ...c,
            final_quantity: totals?.final_quantity ?? c.final_quantity,
            priced_quantity: totals ? totals.priced_quantity : c.priced_quantity,
            material_cost: totals?.material_cost ?? c.material_cost,
            labour_cost: totals?.labour_cost ?? c.labour_cost,
        } : c));
    }
    async function handleUseRoofArea(compId, roofAreaSqm) {
        const _comp = components.find(c => c.id === compId);
        // Roof area total is already pitched - don't apply pitch again
        // `useRoofAreaTotal` is a server action, not a React hook - React's
        // rules-of-hooks heuristic flags it on the `use*` name. Renaming the
        // action is a larger change; suppress here is the lower-risk path.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const entry = await (0, actions_1.useRoofAreaTotal)(compId, roofAreaSqm, null);
        const totals = entry.componentTotals;
        setEntries(prev => ({ ...prev, [compId]: [...(prev[compId] ?? []), entry] }));
        setComponents(prev => prev.map(c => c.id === compId ? {
            ...c,
            final_quantity: totals?.final_quantity ?? c.final_quantity,
            priced_quantity: totals ? totals.priced_quantity : c.priced_quantity,
            material_cost: totals?.material_cost ?? c.material_cost,
            labour_cost: totals?.labour_cost ?? c.labour_cost,
        } : c));
    }
    async function handleRemoveEntry(entryId, compId) {
        const totals = await (0, actions_1.removeComponentEntry)(entryId, compId);
        const updated = (entries[compId] ?? []).filter(e => e.id !== entryId);
        setEntries(prev => ({ ...prev, [compId]: updated }));
        setComponents(prev => prev.map(c => c.id === compId ? {
            ...c,
            final_quantity: totals?.final_quantity ?? c.final_quantity,
            priced_quantity: totals ? totals.priced_quantity : c.priced_quantity,
            material_cost: totals?.material_cost ?? c.material_cost,
            labour_cost: totals?.labour_cost ?? c.labour_cost,
        } : c));
    }
    /** Phase 6.5: collapse all entries on a lineal-shaped component into
     *  one combined entry. Updates local state in-place using the new entry
     *  + recalculated component totals returned by the server action - no
     *  page reload, which previously reset the manual-mode tab state back
     *  to Roof Areas (the internal useState default in QuoteBuilder). */
    async function handleCombineEntries(compId) {
        const result = await (0, actions_1.combineLinealEntries)(compId);
        if (!result.ok || !result.combinedEntry) {
            await notify(result.error ?? 'Could not combine entries.');
            return;
        }
        // Replace this component's entries array with the single combined row.
        // QuoteComponentEntryRow is stale on the Phase 2 is_combined / combined_from
        // columns; the read sites cast at the boundary so the looser shape is fine.
        setEntries((prev) => ({
            ...prev,
            [compId]: [result.combinedEntry],
        }));
        if (result.componentTotals) {
            setComponents((prev) => prev.map((c) => c.id === compId
                ? {
                    ...c,
                    final_quantity: result.componentTotals.final_quantity,
                    priced_quantity: result.componentTotals.priced_quantity,
                    material_cost: result.componentTotals.material_cost,
                    labour_cost: result.componentTotals.labour_cost,
                }
                : c));
        }
    }
    /** Phase 6.5: split a combined entry back into its source rows. Same
     *  in-place state update pattern as combine. */
    async function handleSplitEntries(compId) {
        const result = await (0, actions_1.splitLinealEntries)(compId);
        if (!result.ok || !result.restoredEntries) {
            await notify(result.error ?? 'Could not split entries.');
            return;
        }
        setEntries((prev) => ({
            ...prev,
            [compId]: result.restoredEntries,
        }));
        if (result.componentTotals) {
            setComponents((prev) => prev.map((c) => c.id === compId
                ? {
                    ...c,
                    final_quantity: result.componentTotals.final_quantity,
                    priced_quantity: result.componentTotals.priced_quantity,
                    material_cost: result.componentTotals.material_cost,
                    labour_cost: result.componentTotals.labour_cost,
                }
                : c));
        }
    }
    async function handleUpdateCompSettings(compId, updates) {
        await (0, actions_1.updateComponentSettings)(compId, updates);
        setComponents(prev => prev.map(c => c.id === compId ? { ...c, ...updates } : c));
    }
    // Helper to format component quantity with correct units
    function formatQuantity(qty, measurementType) {
        if (measurementType === 'area') {
            return (0, displayHelpers_1.formatArea)(qty, quote.measurement_system);
        }
        if (measurementType === 'lineal') {
            return (0, displayHelpers_1.formatLinear)(qty, quote.measurement_system);
        }
        return `${qty.toFixed(1)} ${(0, displayHelpers_1.getUnitLabel)(measurementType, quote.measurement_system)}`;
    }
    // Fixed Quantity strategies: show rounded purchasable units (priced_quantity)
    // with actual in italic brackets e.g. "5 (4.84)". per_unit = NULL priced_quantity
    // so falls back to formatQuantity, rendering exactly as before.
    function formatPricedQuantity(c) {
        const actual = Number(c.final_quantity ?? 0);
        // Supabase returns numeric columns as strings at runtime - use Number().
        const priced = c.priced_quantity != null ? Number(c.priced_quantity) : null;
        const packSnap = c.pack_size_snapshot != null ? Number(c.pack_size_snapshot) : null;
        if (priced != null && !isNaN(priced)) {
            const fractional = packSnap && !isNaN(packSnap) && packSnap > 0 ? actual / packSnap : actual;
            return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [priced.toFixed(0), " ", (0, jsx_runtime_1.jsxs)("span", { className: "italic text-slate-400", children: ["(", fractional.toFixed(2), ")"] })] }));
        }
        return formatQuantity(actual, c.measurement_type);
    }
    const phases = [
        { key: 'areas', label: tradeLabels.builderStepLabel, description: 'Define your areas' },
        { key: 'components', label: 'Components', description: 'Measurements and pricing' },
        { key: 'extras', label: 'Extras', description: 'Other items and services' },
        { key: 'review', label: 'Review', description: 'Margins and next steps' },
    ];
    const phaseHelp = {
        areas: tradeLabels.areaIsOptional
            ? 'Add and confirm areas when useful, or continue to Components to price your work directly.'
            : 'Group measurements in areas, or continue to Components to enter a total area, length or quantity directly.',
        components: 'Choose your Smart Components, then add or check their measurements.',
        extras: 'Add saved extras for the other items and services this quote needs.',
        review: 'Check the quantities, costs and margins, then prepare the customer quote or return to Job Space.',
    };
    // Existing validation, update payload and calculation semantics are unchanged.
    // Report the result to Review completion so a failed save is not silent.
    // Continuing with the last saved margins remains an explicit non-blocking option.
    const handleSaveMargins = async () => {
        const matPercent = parseFloat(materialMarginPercent);
        const labPercent = parseFloat(laborMarginPercent);
        if (isNaN(matPercent) || matPercent < 0 || matPercent > 100) {
            return { status: 'not-saved', message: 'Item Cost margin must be between 0 and 100%.' };
        }
        if (isNaN(labPercent) || labPercent < 0 || labPercent > 100) {
            return { status: 'not-saved', message: 'Labour margin must be between 0 and 100%.' };
        }
        setMarginSaving(true);
        try {
            await (0, actions_1.updateQuoteMargins)(quote.id, {
                materialMarginPercent: materialMarginEnabled ? matPercent : null,
                laborMarginPercent: laborMarginEnabled ? labPercent : null,
                materialMarginEnabled,
                laborMarginEnabled,
            });
            // Update local quote state
            setQuote({
                ...quote,
                material_margin_percent: matPercent,
                labor_margin_percent: labPercent,
                material_margin_enabled: materialMarginEnabled,
                labor_margin_enabled: laborMarginEnabled,
            });
            return { status: 'saved' };
        }
        catch (err) {
            console.error('Failed to save margins:', err);
            return { status: 'not-saved', message: 'The margin changes could not be saved. Check your connection and try again.' };
        }
        finally {
            setMarginSaving(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("section", { "data-qc-ui": "v2", "data-qc-page": "quote-builder", "data-qc-phase": phase, className: "qb-workspace", children: [(0, jsx_runtime_1.jsxs)("header", { className: "qb-header", children: [(0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${workspaceSlug}/quotes`, className: "qb-back-link", children: [(0, jsx_runtime_1.jsx)("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "m14 7-5 5 5 5M9 12h11" }) }), "Quotes"] }), (0, jsx_runtime_1.jsx)("p", { className: "qb-eyebrow", children: "Measurements & pricing" }), (0, jsx_runtime_1.jsx)("div", { className: "qb-job-name", children: (0, jsx_runtime_1.jsx)(QuoteNameEditor_1.QuoteNameEditor, { quoteId: quote.id, customerName: quote.customer_name, jobName: quote.job_name }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qb-header-meta", children: [quote.status === 'draft' && ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: (0, jsx_runtime_1.jsx)(CurrencySelector_1.CurrencySelector, { quoteId: quote.id, currentCurrency: quote.currency, companyDefaultCurrency: companyDefaultCurrency, workspaceSlug: workspaceSlug }) })), (0, jsx_runtime_1.jsx)(QcSurface_1.QcStatusBadge, { tone: quote.status === 'draft' ? 'neutral' : 'warning', children: quote.status })] })] }), (0, jsx_runtime_1.jsx)(QuoteJourneyContext_1.QuoteJourneyContext, { digital: quote.entry_mode === 'digital', hasMeasurements: Object.values(entries).some(items => items.length > 0) || Object.values(roofAreaEntries).some(items => items.length > 0), pitchRelevant: tradeLabels.pitchRequired || !!tradeLabels.pitchOptional }), (0, jsx_runtime_1.jsxs)("div", { className: "qb-context-tools", children: [((hasExistingTakeoff || planUrl) && ((0, jsx_runtime_1.jsx)("div", { className: "qb-tools", children: (0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${workspaceSlug}/quotes/${quote.id}/takeoff`, className: "qc-button", "data-qc-component": "C02", "data-qc-variant": "glass", children: [(0, jsx_runtime_1.jsx)("svg", { "aria-hidden": "true", className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }) }), hasExistingTakeoff ? 'Edit Digital Take-off' : 'Use Digital Take-off'] }) }))), (0, jsx_runtime_1.jsx)(FilesManager_1.FilesManager, { quoteId: quote.id, companyId: quote.company_id, workspaceSlug: workspaceSlug, planUrl: planUrl, planName: planName, supportingFiles: supportingFiles, hasExistingTakeoff: hasExistingTakeoff, linesImageUrl: linesImageUrl, planStoragePath: planStoragePath, allPlans: allPlans, isOverStorage: isOverStorage })] }), (0, jsx_runtime_1.jsx)(QcWorkflowStepper_1.QcWorkflowStepper, { steps: phases.map(step => ({ ...step, disabled: reviewCompleting })), current: phase, onSelect: setPhase }), (0, jsx_runtime_1.jsxs)("div", { className: "qb-work-grid", children: [phase !== 'review' && ((0, jsx_runtime_1.jsx)("aside", { className: "qb-totals-rail", children: (0, jsx_runtime_1.jsx)(QcMoneySummary_1.QcMoneySummary, { audience: "internal", title: "Current quote", rows: [
                                        { id: 'area', label: tradeLabels.areaSingularLabel, value: (0, displayHelpers_1.formatArea)(totalRoofSqm, quote.measurement_system) },
                                        { id: 'materials', label: 'Item Cost', value: (0, currencies_1.formatCurrency)(totals.totalMaterials, effectiveCurrency) },
                                        { id: 'labour', label: 'Labour', value: (0, currencies_1.formatCurrency)(totals.totalLabour, effectiveCurrency) },
                                    ], totalLabel: "Quote total", total: (0, currencies_1.formatCurrency)(totals.grandTotal, effectiveCurrency), note: "Uses the saved margin settings. Check margins in Review before continuing." }) })), (0, jsx_runtime_1.jsxs)("div", { className: "qb-step-content", children: [(0, jsx_runtime_1.jsxs)("header", { className: "qb-phase-heading", children: [(0, jsx_runtime_1.jsxs)("p", { className: "qb-eyebrow", children: ["Step ", phases.findIndex(p => p.key === phase) + 1, " of 4"] }), (0, jsx_runtime_1.jsx)("h2", { children: phases.find(p => p.key === phase)?.label }), (0, jsx_runtime_1.jsx)("p", { children: phaseHelp[phase] })] }), phase === 'areas' && ((0, jsx_runtime_1.jsxs)("div", { className: "qb-stack", children: [roofAreas.map(area => ((0, jsx_runtime_1.jsx)(RoofAreaCard_1.RoofAreaCard, { area: area, entries: roofAreaEntries[area.id] ?? [], quote: quote, onUpdate: handleUpdateArea, onToggleLock: handleToggleLock, onAddEntry: handleAddRoofAreaEntry, onRemoveEntry: handleRemoveRoofAreaEntry, onRemove: handleRemoveArea }, area.id))), (0, jsx_runtime_1.jsxs)("div", { className: "qc-surface qb-add-area", "data-copilot": "quote-add-area-row", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: newAreaId, className: "qc-label", children: roofAreas.length === 0 ? 'Name your first area' : 'Add another area' }), (0, jsx_runtime_1.jsxs)("div", { className: "qb-inline-form", children: [(0, jsx_runtime_1.jsx)(QcField_1.QcInput, { id: newAreaId, value: newAreaLabel, onChange: e => setNewAreaLabel(e.target.value), placeholder: tradeLabels.areaIsOptional ? tradeLabels.areaNamePlaceholder : 'e.g. Main Roof, Garage', "data-copilot": "quote-area-name", className: "qb-grow", inputMode: "text", onKeyDown: e => e.key === 'Enter' && handleAddArea() }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { onClick: handleAddArea, disabled: !newAreaLabel.trim(), "data-copilot": "quote-add-area", variant: roofAreas.length === 0 ? 'primary' : 'ghost', children: tradeLabels.addAreaCta })] }), (0, jsx_runtime_1.jsx)("p", { className: "qc-help", children: tradeLabels.areaIsOptional ? 'Areas are optional. You can also add components directly in the next step.' : 'Use a clear name such as Main Roof or Garage to reuse an area total. Already have a total? You can enter it directly in Components.' })] }), (0, jsx_runtime_1.jsx)("div", { className: "qb-step-actions qb-step-actions-end", children: (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { onClick: () => setPhase('components'), disabled: !allAreasLocked, "data-copilot": "quote-next-components", variant: "primary", children: allAreasLocked ? 'Next: Components →' : 'Confirm all areas to continue' }) })] })), phase === 'components' && ((0, jsx_runtime_1.jsxs)("div", { className: "qb-stack", "data-copilot": "quote-components-phase", children: [roofAreas.length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "qc-surface qb-stack", children: [(0, jsx_runtime_1.jsx)("h3", { className: "qb-group-title", children: "Components" }), components.filter(c => !c.quote_roof_area_id).map((comp, idx) => ((0, jsx_runtime_1.jsx)(ExpandableComponent_1.ExpandableComponent, { comp: comp, assistantFocusRequest: assistantFocus?.id === comp.id ? assistantFocus.request : 0, entries: entries[comp.id] ?? [], roofAreas: roofAreas, quote: quote, currency: effectiveCurrency, onAddEntry: handleAddEntry, onRemoveEntry: handleRemoveEntry, onRemove: handleRemoveComponent, onUpdateSettings: handleUpdateCompSettings, onCombineEntries: handleCombineEntries, onSplitEntries: handleSplitEntries, copilotId: idx === 0 ? 'quote-first-component' : undefined }, comp.id))), (0, jsx_runtime_1.jsx)(AddFromLibrary_1.AddFromLibrary, { library: localLibrary, onAdd: libId => handleAddFromLibrary(libId, null, 'main'), onCreateNew: () => { setCreateCompForAreaId(null); setCreateCompType('main'); setShowCreateComponentModal(true); }, copilotId: "quote-add-from-library", measurementSystem: quote.measurement_system })] })), roofAreas.map((area, areaIdx) => {
                                                const areaComps = mainComps.filter(c => c.quote_roof_area_id === area.id);
                                                return ((0, jsx_runtime_1.jsxs)("div", { className: "qc-surface qb-stack", children: [(0, jsx_runtime_1.jsxs)("h3", { className: "qb-group-title", children: [area.label, ' ', (0, jsx_runtime_1.jsxs)("span", { className: "qb-group-meta", children: ["(", (0, displayHelpers_1.formatArea)(area.computed_sqm ?? 0, quote.measurement_system), area.calc_pitch_degrees ? ` @ ${area.calc_pitch_degrees}°` : '', ")"] })] }), areaComps.map((comp, compIdx) => ((0, jsx_runtime_1.jsx)(ExpandableComponent_1.ExpandableComponent, { comp: comp, assistantFocusRequest: assistantFocus?.id === comp.id ? assistantFocus.request : 0, entries: entries[comp.id] ?? [], roofAreas: roofAreas, roofArea: area, quote: quote, currency: effectiveCurrency, onAddEntry: handleAddEntry, onUseRoofArea: handleUseRoofArea, onRemoveEntry: handleRemoveEntry, onRemove: handleRemoveComponent, onUpdateSettings: handleUpdateCompSettings, onCombineEntries: handleCombineEntries, onSplitEntries: handleSplitEntries, copilotId: areaIdx === 0 && compIdx === 0 ? 'quote-first-component' : undefined }, comp.id))), (0, jsx_runtime_1.jsx)(AddFromLibrary_1.AddFromLibrary, { library: localLibrary.filter(c => c.component_type === 'main'), onAdd: libId => handleAddFromLibrary(libId, area.id, 'main'), onCreateNew: () => { setCreateCompForAreaId(area.id); setCreateCompType('main'); setShowCreateComponentModal(true); }, copilotId: areaIdx === 0 ? 'quote-add-from-library' : undefined, measurementSystem: quote.measurement_system })] }, area.id));
                                            }), (0, jsx_runtime_1.jsxs)("div", { className: "qb-step-actions", children: [(0, jsx_runtime_1.jsxs)(QcButton_1.QcButton, { onClick: () => setPhase('areas'), variant: "ghost", children: ["\u2190 ", tradeLabels.areaPluralLabel] }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { onClick: () => setPhase('extras'), "data-copilot": "quote-next-extras", variant: "primary", children: "Next: Extras \u2192" })] })] })), phase === 'extras' && ((0, jsx_runtime_1.jsxs)("div", { className: "qb-stack", "data-copilot": "quote-extras-phase", children: [(0, jsx_runtime_1.jsxs)("div", { className: "qc-surface qb-stack", children: [(0, jsx_runtime_1.jsx)("h3", { className: "qb-group-title", children: "Extras" }), (0, jsx_runtime_1.jsx)(QcSurface_1.QcNotice, { children: "Choose saved extras below, or create a Smart Component to reuse later. Fully custom lines are added in the customer quote editor after this builder." }), extraComps.map(comp => ((0, jsx_runtime_1.jsx)(ExpandableComponent_1.ExpandableComponent, { comp: comp, assistantFocusRequest: assistantFocus?.id === comp.id ? assistantFocus.request : 0, entries: entries[comp.id] ?? [], roofAreas: roofAreas, quote: quote, currency: effectiveCurrency, onAddEntry: handleAddEntry, onRemoveEntry: handleRemoveEntry, onRemove: handleRemoveComponent, onUpdateSettings: handleUpdateCompSettings, onCombineEntries: handleCombineEntries, onSplitEntries: handleSplitEntries }, comp.id))), (0, jsx_runtime_1.jsx)(AddFromLibrary_1.AddFromLibrary, { library: localLibrary.filter(c => c.component_type === 'extra'), onAdd: libId => handleAddFromLibrary(libId, null, 'extra'), onCreateNew: () => { setCreateCompForAreaId(null); setCreateCompType('extra'); setShowCreateComponentModal(true); }, measurementSystem: quote.measurement_system })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qb-step-actions", children: [(0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { onClick: () => setPhase('components'), variant: "ghost", children: "\u2190 Smart Components\u2122" }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { onClick: () => setPhase('review'), "data-copilot": "quote-next-review", variant: "primary", children: "Next: Review \u2192" })] })] })), phase === 'review' && ((0, jsx_runtime_1.jsxs)("div", { className: "qb-stack", "data-copilot": "quote-review-phase", children: [roofAreas.map(area => {
                                                const areaComps = components.filter(c => c.quote_roof_area_id === area.id);
                                                return ((0, jsx_runtime_1.jsxs)("div", { className: "qc-surface qb-review-card", children: [(0, jsx_runtime_1.jsxs)("h3", { className: "qb-group-title", children: [area.label, " - ", (0, displayHelpers_1.formatArea)(area.computed_sqm ?? 0, quote.measurement_system)] }), areaComps.length > 0 ? ((0, jsx_runtime_1.jsx)(ScrollIndicator_1.ScrollIndicator, { className: "qb-review-scroll", ariaLabel: "Quote quantities and costs", children: (0, jsx_runtime_1.jsxs)("table", { className: "qb-review-table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-left text-xs text-slate-500 border-b", children: [(0, jsx_runtime_1.jsx)("th", { className: "py-1 whitespace-nowrap", children: "Component" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Entries" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Total Qty" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Item Cost" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Labour" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Total" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: areaComps.map(c => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-slate-100", children: [(0, jsx_runtime_1.jsxs)("td", { className: "py-1.5 whitespace-nowrap", children: [c.name, (c.is_rate_overridden || c.is_waste_overridden) && ((0, jsx_runtime_1.jsx)("span", { className: "qb-override", title: "Overridden from template default", "aria-label": "Overridden from template default", children: (0, jsx_runtime_1.jsx)("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: (0, jsx_runtime_1.jsx)("circle", { cx: "12", cy: "12", r: "4" }) }) }))] }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: (entries[c.id] ?? []).length }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: formatPricedQuantity(c) }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: (0, currencies_1.formatCurrency)(c.material_cost ?? 0, effectiveCurrency) }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: (0, currencies_1.formatCurrency)(c.labour_cost ?? 0, effectiveCurrency) }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right font-medium whitespace-nowrap", children: (0, currencies_1.formatCurrency)((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency) })] }, c.id))) })] }) })) : ((0, jsx_runtime_1.jsx)("p", { className: "qc-help", children: "No components" }))] }, area.id));
                                            }), roofAreas.length === 0 && (() => {
                                                const noAreaComps = components.filter(c => !c.quote_roof_area_id);
                                                if (noAreaComps.length === 0)
                                                    return null;
                                                return ((0, jsx_runtime_1.jsxs)("div", { className: "qc-surface qb-review-card", children: [(0, jsx_runtime_1.jsx)("h3", { className: "qb-group-title", children: "Quote items" }), (0, jsx_runtime_1.jsx)(ScrollIndicator_1.ScrollIndicator, { className: "qb-review-scroll", ariaLabel: "Quote quantities and costs", children: (0, jsx_runtime_1.jsxs)("table", { className: "qb-review-table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-left text-xs text-slate-500 border-b", children: [(0, jsx_runtime_1.jsx)("th", { className: "py-1 whitespace-nowrap", children: "Component" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Entries" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Total Qty" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Item Cost" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Labour" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Total" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: noAreaComps.map(c => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-slate-100", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-1.5 whitespace-nowrap", children: c.name }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: (entries[c.id] ?? []).length }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: formatPricedQuantity(c) }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: (0, currencies_1.formatCurrency)(c.material_cost ?? 0, effectiveCurrency) }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: (0, currencies_1.formatCurrency)(c.labour_cost ?? 0, effectiveCurrency) }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right font-medium whitespace-nowrap", children: (0, currencies_1.formatCurrency)((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency) })] }, c.id))) })] }) })] }));
                                            })(), extraComps.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "qc-surface qb-review-card", children: [(0, jsx_runtime_1.jsx)("h3", { className: "qb-group-title", children: "Extras" }), (0, jsx_runtime_1.jsx)(ScrollIndicator_1.ScrollIndicator, { className: "qb-review-scroll", ariaLabel: "Quote quantities and costs", children: (0, jsx_runtime_1.jsxs)("table", { className: "qb-review-table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-left text-xs text-slate-500 border-b", children: [(0, jsx_runtime_1.jsx)("th", { className: "py-1 whitespace-nowrap", children: "Extra" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Entries" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Total Qty" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Item Cost" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Labour" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-right whitespace-nowrap", children: "Total" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: extraComps.map(c => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-amber-100", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-1.5 whitespace-nowrap", children: c.name }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: (entries[c.id] ?? []).length }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: formatPricedQuantity(c) }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: (0, currencies_1.formatCurrency)(c.material_cost ?? 0, effectiveCurrency) }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right whitespace-nowrap", children: (0, currencies_1.formatCurrency)(c.labour_cost ?? 0, effectiveCurrency) }), (0, jsx_runtime_1.jsx)("td", { className: "py-1.5 text-right font-medium whitespace-nowrap", children: (0, currencies_1.formatCurrency)((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency) })] }, c.id))) })] }) })] })), (0, jsx_runtime_1.jsxs)("div", { className: "qb-review-grid", children: [(0, jsx_runtime_1.jsxs)("div", { ref: marginSectionRef, tabIndex: -1, "aria-label": "Profit margins", className: "qc-surface qb-margins qb-stack", "data-copilot": "quote-margins", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "qb-group-title", children: "Profit margins" }), (0, jsx_runtime_1.jsx)("p", { className: "qc-help", children: "Adjust your margins here. Both completion options save these settings. You can also adjust margins in the customer quote editor." })] }), (0, jsx_runtime_1.jsxs)("fieldset", { disabled: reviewCompleting || marginSaving, className: "qrc-margin-inputs grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4", "aria-label": "Margin settings", children: [(0, jsx_runtime_1.jsxs)("div", { className: "qb-margin-field", children: [(0, jsx_runtime_1.jsxs)("label", { className: "qc-check-label", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: materialMarginEnabled, onChange: (e) => setMaterialMarginEnabled(e.target.checked), className: "qc-check" }), (0, jsx_runtime_1.jsx)("span", { className: "qc-label", children: "Item Cost Margin" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qb-percent-input", children: [(0, jsx_runtime_1.jsx)(QcField_1.QcInput, { type: "number", min: "0", max: "100", step: "0.1", id: materialMarginId, "aria-label": "Item Cost Margin percentage", value: materialMarginPercent, onChange: (e) => setMaterialMarginPercent(e.target.value), disabled: !materialMarginEnabled, className: "qb-full-width", inputMode: "decimal" }), (0, jsx_runtime_1.jsx)("span", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium", children: "%" })] }), materialMarginEnabled && ((0, jsx_runtime_1.jsxs)("p", { className: "qc-help qb-margin-preview", children: ["+", (0, currencies_1.formatCurrency)(totals.totalMaterials * (parseFloat(materialMarginPercent) || 0) / 100, effectiveCurrency), " profit"] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "qb-margin-field", children: [(0, jsx_runtime_1.jsxs)("label", { className: "qc-check-label", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: laborMarginEnabled, onChange: (e) => setLaborMarginEnabled(e.target.checked), className: "qc-check" }), (0, jsx_runtime_1.jsx)("span", { className: "qc-label", children: "Labour Margin" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qb-percent-input", children: [(0, jsx_runtime_1.jsx)(QcField_1.QcInput, { type: "number", min: "0", max: "100", step: "0.1", id: labourMarginId, "aria-label": "Labour Margin percentage", value: laborMarginPercent, onChange: (e) => setLaborMarginPercent(e.target.value), disabled: !laborMarginEnabled, className: "qb-full-width", inputMode: "decimal" }), (0, jsx_runtime_1.jsx)("span", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium", children: "%" })] }), laborMarginEnabled && ((0, jsx_runtime_1.jsxs)("p", { className: "qc-help qb-margin-preview", children: ["+", (0, currencies_1.formatCurrency)(totals.totalLabour * (parseFloat(laborMarginPercent) || 0) / 100, effectiveCurrency), " profit"] }))] })] }), (0, jsx_runtime_1.jsx)("div", { className: "qc-notice", children: (0, jsx_runtime_1.jsxs)("p", { className: "qc-help", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Customer visibility:" }), " Choose what customers see in the customer quote editor. Review the customer document before sending."] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-surface qb-review-totals", children: [(0, jsx_runtime_1.jsx)("h3", { className: "qb-group-title", children: "Quote breakdown" }), (0, jsx_runtime_1.jsx)("p", { className: "qc-help", children: "Margin previews reflect your entries. Tax and grand total below use saved margins until you save this pricing." }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-sm", children: [(0, jsx_runtime_1.jsx)("span", { children: "Total Item Cost" }), (0, jsx_runtime_1.jsx)("span", { children: (0, currencies_1.formatCurrency)(totals.totalMaterials, effectiveCurrency) })] }), materialMarginEnabled && parseFloat(materialMarginPercent) > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-sm text-emerald-600 font-medium", children: [(0, jsx_runtime_1.jsxs)("span", { className: "ml-4 text-xs", children: ["+ Item Cost Margin (", materialMarginPercent, "%)"] }), (0, jsx_runtime_1.jsxs)("span", { children: ["+", (0, currencies_1.formatCurrency)(totals.totalMaterials * parseFloat(materialMarginPercent) / 100, effectiveCurrency)] })] })), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-sm", children: [(0, jsx_runtime_1.jsx)("span", { children: "Total Labour" }), (0, jsx_runtime_1.jsx)("span", { children: (0, currencies_1.formatCurrency)(totals.totalLabour, effectiveCurrency) })] }), laborMarginEnabled && parseFloat(laborMarginPercent) > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-sm text-emerald-600 font-medium", children: [(0, jsx_runtime_1.jsxs)("span", { className: "ml-4 text-xs", children: ["+ Labour Margin (", laborMarginPercent, "%)"] }), (0, jsx_runtime_1.jsxs)("span", { children: ["+", (0, currencies_1.formatCurrency)(totals.totalLabour * parseFloat(laborMarginPercent) / 100, effectiveCurrency)] })] })), ((materialMarginEnabled && parseFloat(materialMarginPercent) > 0) || (laborMarginEnabled && parseFloat(laborMarginPercent) > 0)) && ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-sm font-semibold text-emerald-600 border-t border-emerald-100 pt-2", children: [(0, jsx_runtime_1.jsx)("span", { children: "Total Margin" }), (0, jsx_runtime_1.jsxs)("span", { children: ["+", (0, currencies_1.formatCurrency)((materialMarginEnabled ? totals.totalMaterials * parseFloat(materialMarginPercent || '0') / 100 : 0) +
                                                                                (laborMarginEnabled ? totals.totalLabour * parseFloat(laborMarginPercent || '0') / 100 : 0), effectiveCurrency)] })] })), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-sm border-t pt-2", children: [(0, jsx_runtime_1.jsx)("span", { children: "Subtotal" }), (0, jsx_runtime_1.jsx)("span", { children: (0, currencies_1.formatCurrency)(totals.totalMaterials + totals.totalLabour +
                                                                            (materialMarginEnabled ? totals.totalMaterials * parseFloat(materialMarginPercent || '0') / 100 : 0) +
                                                                            (laborMarginEnabled ? totals.totalLabour * parseFloat(laborMarginPercent || '0') / 100 : 0), effectiveCurrency) })] }), totals.tax > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-sm", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Tax (", quote.tax_rate, "%)"] }), (0, jsx_runtime_1.jsx)("span", { children: (0, currencies_1.formatCurrency)(totals.tax, effectiveCurrency) })] })), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-lg font-bold border-t pt-2", children: [(0, jsx_runtime_1.jsx)("span", { children: "Grand Total" }), (0, jsx_runtime_1.jsx)("span", { children: (0, currencies_1.formatCurrency)(totals.grandTotal, effectiveCurrency) })] })] })] }), (0, jsx_runtime_1.jsx)("p", { className: "qc-help", children: "A dot marks a value overridden from its template default." }), (0, jsx_runtime_1.jsx)(ConfirmQuoteButton_1.ConfirmQuoteButton, { quoteId: quote.id, workspaceSlug: workspaceSlug, quoteStatus: quote.status, onBeforeSubmit: handleSaveMargins, onPendingChange: setReviewCompleting, onConfirmed: () => setQuote(current => ({ ...current, status: 'confirmed' })), onReviewMargins: () => {
                                                    marginSectionRef.current?.focus({ preventScroll: true });
                                                    marginSectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                                                } }, quote.id), (0, jsx_runtime_1.jsx)("div", { className: "qb-step-actions", children: (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { onClick: () => setPhase('extras'), variant: "ghost", disabled: reviewCompleting, children: "\u2190 Back to Extras" }) })] }))] })] })] }), feedback, (0, jsx_runtime_1.jsx)(ConfirmModal_1.ConfirmModal, { appearance: "v2", open: showEmptyQuoteGuard !== null, title: showEmptyQuoteGuard === 'no-main-components' ? 'Add at least one component' : `Add at least one ${tradeLabels.areaSingularLabel.toLowerCase()}`, description: showEmptyQuoteGuard === 'no-main-components'
                    ? `Your quote has a ${tradeLabels.areaSingularLabel.toLowerCase()} but no main components yet. Add at least one component before saving the quote.`
                    : tradeLabels.emptyAreaGuardMessage, confirmLabel: "OK, take me there", cancelLabel: "Stay here", destructive: false, onCancel: () => setShowEmptyQuoteGuard(null), onConfirm: () => {
                    // Bounce to the right step: if there's no area at all we go to
                    // Roof Areas; if there's an area but no main components, we go
                    // straight to the Components phase where they pick from the
                    // library.
                    const target = showEmptyQuoteGuard === 'no-main-components' ? 'components' : 'areas';
                    setShowEmptyQuoteGuard(null);
                    setPhase(target);
                } }), (0, jsx_runtime_1.jsx)(ConfirmModal_1.ConfirmModal, { appearance: "v2", open: areaPendingDelete !== null, title: `Remove ${tradeLabels.areaSingularLabel.toLowerCase()}`, description: areaPendingDelete
                    ? `Remove "${areaPendingDelete.label}"? Every component attached to this area (and their entries, customer-quote lines, and labor-sheet lines) will also be deleted. This cannot be undone.`
                    : '', confirmLabel: "Remove area + components", pendingLabel: "Removing...", pending: areaDeleting, onCancel: () => { if (!areaDeleting)
                    setAreaPendingDelete(null); }, onConfirm: confirmRemoveArea }), showCreateComponentModal && ((0, jsx_runtime_1.jsx)(CreateSmartComponentModal_1.CreateSmartComponentModal, { appearance: "v2", measurementSystem: companyMeasurementSystem, defaultTrade: companyDefaultTrade, defaultComponentType: createCompType, collections: collections, onCreated: handleComponentCreated, onClose: () => setShowCreateComponentModal(false) }))] }));
}

},"app/components/quote-entry/QuoteJourneyContext.tsx":function(require,module,exports){
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteJourneyContext = QuoteJourneyContext;
exports.MeasurementBasisHelp = MeasurementBasisHelp;
const jsx_runtime_1 = require("react/jsx-runtime");
const quoteJourney_1 = require("app/components/quote-entry/quoteJourney.ts");
require("app/components/quote-entry/quote-entry.css");
/** C73: one arrival vocabulary for both existing builders. This component never
 * hydrates measurements, sets phases, refreshes the route or changes pitch.
 * Guided stays dark; this is not a mode selector or a second editor.
 */
function QuoteJourneyContext({ digital, hasMeasurements, pitchRelevant }) {
    return (0, jsx_runtime_1.jsxs)("details", { className: "qce-context", "data-qc-component": "C73", "data-pricing-experience": (0, quoteJourney_1.resolvePricingExperience)(), children: [(0, jsx_runtime_1.jsxs)("summary", { children: [(0, jsx_runtime_1.jsxs)("span", { className: "qce-context-title", children: [quoteJourney_1.PRICING_EXPERIENCE_LABEL, " workspace"] }), (0, jsx_runtime_1.jsx)("span", { className: "qce-context-summary", children: hasMeasurements ? 'Check measurements, then pricing' : 'Add measurements to price this job' }), (0, jsx_runtime_1.jsx)("span", { className: "qce-context-help", children: "How it works" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qce-context-body", children: [(0, jsx_runtime_1.jsx)("p", { children: digital && hasMeasurements
                            ? 'Saved Takeoff measurements are loaded here. Check the areas and components, add anything missing, then review the price.'
                            : digital ? 'Add or check the measurements for this job. The existing Digital Takeoff action remains available when you need to measure a plan.'
                                : 'Use measurements from any source. Areas let you reuse a total across components. You can also go straight to Components and enter an area, length or quantity there.' }), pitchRelevant && (0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Plan or actual?" }), " Choose this on each component. Plan measurements can use its pitch rule; actual measurements are already measured along the surface. Waste and purchasing rules still apply. Keep different measurement types separate."] }), (0, jsx_runtime_1.jsx)("p", { children: "Both entry paths use this same pricing workspace. Review margins and tax before creating the customer quote." })] })] });
}
/** Read-only interpretation help. The existing component handler owns input_mode.
 * Never infer that all measurements in a job share a pitch/basis.
 */
function MeasurementBasisHelp({ isPlan, hasPitch }) {
    return (0, jsx_runtime_1.jsx)("p", { className: "qce-basis-help", children: !hasPitch ? 'This component has no pitch adjustment. Waste and purchasing rules still apply.'
            : isPlan ? 'Measured from above. The component’s pitch rule uses the area pitch or a custom angle below.'
                : 'Already measured along the surface. No pitch is added; waste and purchasing rules still apply.' });
}

},"app/components/quote-entry/quoteJourney.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICING_EXPERIENCE_LABEL = exports.CURRENT_PRICING_EXPERIENCE = void 0;
exports.resolvePricingExperience = resolvePricingExperience;
exports.quoteJourneyDestination = quoteJourneyDestination;
exports.entryModeFromHint = entryModeFromHint;
exports.CURRENT_PRICING_EXPERIENCE = 'advanced';
exports.PRICING_EXPERIENCE_LABEL = 'Advanced';
/** Future callers may request assistance; unavailable modes must fail to the
 * real workspace, never to an unimplemented route. Wire Guided only after its
 * own implementation/acceptance. Do not overload entry_mode with this choice.
 */
function resolvePricingExperience(_requested) {
    return exports.CURRENT_PRICING_EXPERIENCE;
}
/** Existing physical routes; both component paths render the same QuoteBuilder.
 * Keep digital /build and its step contract: Takeoff and mobile already use it.
 * Template creation owns its redirect in the existing server action.
 */
function quoteJourneyDestination({ workspaceSlug, quoteId, entryMode, stage = 'start', experience }) {
    // The resolver is deliberately independent of how measurements were acquired.
    resolvePricingExperience(experience);
    const base = `/${encodeURIComponent(workspaceSlug)}/quotes/${encodeURIComponent(quoteId)}`;
    if (entryMode === 'blank')
        return `${base}/blank-build`;
    if (entryMode === 'digital')
        return stage === 'start' ? `${base}/takeoff` : `${base}/build?step=roof-areas`;
    return base;
}
/** Optional deep-link entry hint, never an entitlement or a persisted mode. */
function entryModeFromHint(value) {
    if (value === 'known')
        return 'manual';
    if (value === 'digital')
        return 'digital';
    return null;
}

},"app/components/quote-entry/quote-entry.css":function(require,module,exports){

},"next/link":function(require,module,exports){
exports.__esModule=true;exports.default=({children,prefetch,...props})=>require('react').createElement('a',props,children);
},"app/lib/smart-assistant/v2/component-focus.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPONENT_FOCUS_EVENT = void 0;
exports.componentFocusId = componentFocusId;
exports.notifyComponentFocus = notifyComponentFocus;
/** Presentation-only handoff. The destination API has already re-authorised the
 * stored card's parent/child. This event cannot read records or perform edits.
 */
const contracts_1 = require("app/lib/smart-assistant/v2/contracts.ts");
exports.COMPONENT_FOCUS_EVENT = 'quotecore:assistant-component-focus';
function componentFocusId(search) {
    const values = new URLSearchParams(search).getAll('sa_component');
    return values.length === 1 && (0, contracts_1.isUuid)(values[0]) ? values[0] : null;
}
function notifyComponentFocus() {
    if (typeof window !== 'undefined' && componentFocusId(window.location.search))
        window.dispatchEvent(new Event(exports.COMPONENT_FOCUS_EVENT));
}

},"app/lib/smart-assistant/v2/contracts.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENTITY_KINDS = exports.ENTITY_SECTIONS = void 0;
exports.parseRunOutcome = parseRunOutcome;
exports.isUuid = isUuid;
exports.boundedText = boundedText;
exports.parseTarget = parseTarget;
exports.canRead = canRead;
exports.canEdit = canEdit;
exports.parseAccess = parseAccess;
exports.parseHit = parseHit;
exports.parseOption = parseOption;
exports.parseCard = parseCard;
exports.parseActionView = parseActionView;
exports.parsePublicAccess = parsePublicAccess;
exports.parseMessage = parseMessage;
exports.parsePublicSession = parsePublicSession;
/** Wire contracts shared by the assistant UI and server. No privileged imports. */
const section_permissions_1 = require("app/lib/smart-assistant/section-permissions.ts");
const contracts_1 = require("app/lib/smart-assistant/tasks/contracts.ts");
function parseRunOutcome(value) {
    if (!(0, section_permissions_1.isRecord)(value) || !isUuid(value.id) || !isUuid(value.client_request_id) || !['accepted', 'running', 'completed', 'failed', 'cancelled', 'aborted', 'timed_out'].includes(String(value.status)))
        return null;
    return { id: value.id, requestId: value.client_request_id, status: String(value.status),
        errorCode: typeof value.error_code === 'string' ? value.error_code.slice(0, 240) : null };
}
exports.ENTITY_SECTIONS = {
    quote: 'quotes', draft_quote: 'draft_quotes', order: 'orders', invoice: 'invoices',
    component: 'components', customer: 'customers',
};
exports.ENTITY_KINDS = Object.keys(exports.ENTITY_SECTIONS);
function isUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function boundedText(value, max) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value) ? value.trim() : null;
}
function parseTarget(value) {
    if (!(0, section_permissions_1.isRecord)(value) || !exports.ENTITY_KINDS.includes(value.kind) || !isUuid(value.id))
        return null;
    if (value.focus === undefined)
        return { kind: value.kind, id: value.id };
    if (!['quote', 'draft_quote'].includes(String(value.kind)) || !(0, section_permissions_1.isRecord)(value.focus)
        || Object.keys(value.focus).some(k => !['kind', 'id'].includes(k))
        || value.focus.kind !== 'quote_component' || !isUuid(value.focus.id))
        return null;
    return { kind: value.kind, id: value.id, focus: { kind: 'quote_component', id: value.focus.id } };
}
function canRead(access, section) {
    return access.phases.p1 && access.permissions[section] !== 'hidden';
}
function canEdit(access, section) {
    return access.phases.p3 && access.permissions[section] === 'edit';
}
function parseAccess(value) {
    if (!(0, section_permissions_1.isRecord)(value) || !isUuid(value.user_id) || !isUuid(value.company_id)
        || typeof value.workspace_slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/i.test(value.workspace_slug)
        || !(0, section_permissions_1.isRecord)(value.phases))
        return null;
    const permissions = (0, section_permissions_1.parseSectionPermissions)(value.permissions);
    if (!permissions || !Number.isInteger(value.permission_revision) || Number(value.permission_revision) < 0)
        return null;
    const phases = {};
    for (const key of ['p1', 'p2', 'p3', 'p4']) {
        if (typeof value.phases[key] !== 'boolean')
            return null;
        phases[key] = value.phases[key];
    }
    if ((phases.p2 && !phases.p1) || (phases.p3 && !phases.p2) || (phases.p4 && !phases.p3))
        return null;
    if (value.history_after !== null && (typeof value.history_after !== 'string' || !Number.isFinite(Date.parse(value.history_after))))
        return null;
    return {
        userId: value.user_id, companyId: value.company_id, workspaceSlug: value.workspace_slug,
        phases, permissions, permissionRevision: Number(value.permission_revision),
        historyAfter: value.history_after,
        writePolicy: typeof value.write_policy === 'string' ? value.write_policy : null,
    };
}
function parseHit(value) {
    const target = parseTarget(value);
    if (!target || !(0, section_permissions_1.isRecord)(value) || value.section !== exports.ENTITY_SECTIONS[target.kind]
        || !boundedText(value.label, 300) || typeof value.detail !== 'string' || value.detail.length > 600
        || typeof value.score !== 'number' || !Number.isFinite(value.score) || !(0, section_permissions_1.isRecord)(value.fields))
        return null;
    return { ...target, section: exports.ENTITY_SECTIONS[target.kind], label: String(value.label), detail: value.detail,
        score: value.score, status: typeof value.status === 'string' ? value.status : null, fields: value.fields };
}
function parseOption(value) {
    const target = parseTarget(value);
    if (!target || !(0, section_permissions_1.isRecord)(value) || !boundedText(value.label, 300) || typeof value.detail !== 'string' || value.detail.length > 600)
        return null;
    return { ...target, label: String(value.label), detail: value.detail };
}
function parseCard(value) {
    if (!(0, section_permissions_1.isRecord)(value) || !isUuid(value.id) || !isUuid(value.run_id) || typeof value.created_at !== 'string' || !(0, section_permissions_1.isRecord)(value.content))
        return null;
    const c = value.content;
    if (!boundedText(c.title, 300))
        return null;
    let content;
    if (c.kind === 'records') {
        if (!Array.isArray(c.options) || c.options.length > 10 || typeof c.autoOpen !== 'boolean')
            return null;
        const options = c.options.map(parseOption);
        if (options.some((v) => !v))
            return null;
        content = { kind: c.kind, title: String(c.title), options: options, autoOpen: c.autoOpen,
            note: typeof c.note === 'string' ? c.note.slice(0, 800) : null };
    }
    else if (c.kind === 'choices') {
        if (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 4)
            return null;
        const options = [];
        for (const o of c.options) {
            if (!(0, section_permissions_1.isRecord)(o) || !boundedText(o.label, 100) || !boundedText(o.reply, 500))
                return null;
            options.push({ label: String(o.label), reply: String(o.reply) });
        }
        content = { kind: c.kind, title: String(c.title), options };
    }
    else if (c.kind === 'resolution') {
        if (!isUuid(c.stateId) || typeof c.expiresAt !== 'string' || !Number.isFinite(Date.parse(c.expiresAt))
            || !boundedText(c.question, 400) || !Array.isArray(c.options) || c.options.length < 1 || c.options.length > 5)
            return null;
        const options = [];
        for (const option of c.options) {
            if (!(0, section_permissions_1.isRecord)(option) || !isUuid(option.choiceId) || !boundedText(option.label, 300)
                || typeof option.detail !== 'string' || option.detail.length > 600
                || Object.keys(option).some(k => !['choiceId', 'label', 'detail'].includes(k)))
                return null;
            options.push({ choiceId: option.choiceId, label: String(option.label), detail: option.detail });
        }
        if (new Set(options.map(o => o.choiceId)).size !== options.length)
            return null;
        content = { kind: 'resolution', title: String(c.title), stateId: c.stateId, expiresAt: c.expiresAt, question: String(c.question), options };
    }
    else if (c.kind === 'attention') {
        if (!Array.isArray(c.groups) || c.groups.length > 5 || typeof c.asOf !== 'string' || typeof c.note !== 'string')
            return null;
        const groups = [];
        for (const g of c.groups) {
            if (!(0, section_permissions_1.isRecord)(g) || typeof g.key !== 'string' || typeof g.title !== 'string'
                || !['available', 'hidden', 'unavailable'].includes(String(g.state)) || !Array.isArray(g.items) || g.items.length > 10
                || !(g.count === null || (typeof g.count === 'number' && Number.isSafeInteger(g.count) && g.count >= 0)) || typeof g.note !== 'string')
                return null;
            const items = g.items.map(parseOption);
            if (items.some((v) => !v))
                return null;
            groups.push({ key: g.key, title: g.title, state: g.state, count: g.count,
                items: items, note: g.note });
        }
        content = { kind: c.kind, title: String(c.title), groups, asOf: c.asOf, note: c.note };
    }
    else if (c.kind === 'proposal' && isUuid(c.actionId)) {
        content = { kind: c.kind, title: String(c.title), actionId: c.actionId };
    }
    else
        return null;
    return { id: value.id, runId: value.run_id, createdAt: value.created_at, content };
}
function parseActionView(value) {
    if (!(0, section_permissions_1.isRecord)(value) || !isUuid(value.id) || !['proposed', 'applying', 'committed', 'cancelled', 'conflict', 'needs_review', 'failed'].includes(String(value.status))
        || !boundedText(value.title, 300) || !Array.isArray(value.changes) || value.changes.length > 80
        || typeof value.note !== 'string' || typeof value.proof_digest !== 'string' || !/^[a-f0-9]{64}$/.test(value.proof_digest)
        || !Number.isSafeInteger(value.version) || typeof value.created_at !== 'string'
        || !Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 9
        || value.sections.some(s => !section_permissions_1.ASSISTANT_SECTIONS.some(allowed => allowed.key === s)))
        return null;
    const changes = [];
    for (const c of value.changes) {
        if (!(0, section_permissions_1.isRecord)(c) || typeof c.label !== 'string' || typeof c.before !== 'string' || typeof c.after !== 'string'
            || c.label.length > 300 || c.before.length > 2000 || c.after.length > 2000)
            return null;
        // Never silently truncate the exact change the user is being asked to approve.
        changes.push({ label: c.label, before: c.before, after: c.after });
    }
    return { sections: value.sections, actionKind: ['quote_details', 'component_change', 'draft_create', 'area_change'].includes(String(value.action_kind)) ? value.action_kind : null, id: value.id, status: value.status, title: String(value.title), changes,
        note: value.note, proofDigest: value.proof_digest, version: Number(value.version),
        target: parseTarget(value.target), error: typeof value.error === 'string' ? value.error : null, createdAt: value.created_at };
}
/** Decode the public camel-case boundary through the same authoritative parser. */
function parsePublicAccess(value) {
    if (!(0, section_permissions_1.isRecord)(value))
        return null;
    return parseAccess({ user_id: value.userId, company_id: value.companyId, workspace_slug: value.workspaceSlug,
        phases: value.phases, permissions: value.permissions, permission_revision: value.permissionRevision,
        history_after: value.historyAfter, write_policy: value.writePolicy });
}
function parseMessage(value) {
    if (!(0, section_permissions_1.isRecord)(value) || !isUuid(value.id) || !['user', 'assistant'].includes(String(value.role))
        || typeof value.content !== 'string' || typeof value.created_at !== 'string')
        return null;
    return { id: value.id, role: value.role, content: value.content,
        runId: isUuid(value.run_id) ? value.run_id : null, createdAt: value.created_at };
}
/** Public HTTP shape decoder. Fail closed rather than render executable objects. */
function parsePublicSession(value) {
    if (!(0, section_permissions_1.isRecord)(value))
        return null;
    const access = parsePublicAccess(value.access);
    if (!access || !Array.isArray(value.cards) || value.cards.length > 80 || !Array.isArray(value.actions) || value.actions.length > 60 || !Array.isArray(value.messages) || value.messages.length > 100 || !Array.isArray(value.runs) || value.runs.length > 20)
        return null;
    const cards = value.cards.map(c => (0, section_permissions_1.isRecord)(c) ? parseCard({ ...c, run_id: c.runId, created_at: c.createdAt }) : null);
    const actions = value.actions.map(a => (0, section_permissions_1.isRecord)(a) ? parseActionView({ ...a, action_kind: a.actionKind, proof_digest: a.proofDigest, created_at: a.createdAt }) : null);
    const messages = value.messages.map(m => (0, section_permissions_1.isRecord)(m) ? parseMessage({ ...m, run_id: m.runId, created_at: m.createdAt }) : null);
    const runs = value.runs.map(v => (0, section_permissions_1.isRecord)(v) ? parseRunOutcome({ ...v, client_request_id: v.requestId, error_code: v.errorCode }) : null);
    if (cards.some(c => !c) || actions.some(a => !a) || messages.some(m => !m) || runs.some(r => !r))
        return null;
    let page = null;
    if (value.page !== null) {
        if (!(0, section_permissions_1.isRecord)(value.page) || typeof value.page.pathname !== 'string' || value.page.pathname.length > 500)
            return null;
        page = { pathname: value.page.pathname, target: parseTarget(value.page.target) };
    }
    const task = value.task == null ? null : (0, contracts_1.parseTaskView)(value.task);
    if (value.task != null && !task)
        return null;
    return { ...(value.task !== undefined ? { task } : {}), access, cards: cards.filter(c => c !== null), actions: actions.filter(a => a !== null), messages: messages.filter(m => m !== null), runs: runs.filter(r => r !== null), page, activeRunId: isUuid(value.activeRunId) ? value.activeRunId : null, runStatus: typeof value.runStatus === 'string' ? value.runStatus : null };
}

},"app/lib/smart-assistant/section-permissions.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SECTION_PERMISSIONS = exports.PERMISSION_LEVELS = exports.ASSISTANT_SECTIONS = void 0;
exports.isRecord = isRecord;
exports.isPermissionLevel = isPermissionLevel;
exports.parseSectionPermissions = parseSectionPermissions;
exports.permissionsEqual = permissionsEqual;
exports.isPermissionRevision = isPermissionRevision;
exports.parsePermissionSnapshot = parsePermissionSnapshot;
exports.parseSavePermissionsInput = parseSavePermissionsInput;
exports.permissionFailure = permissionFailure;
/**
 * P0 configuration contract only. Nothing in V1 tool admission imports this file.
 * Draft quotes are separate by the owner's 2026-09-24 decision.
 */
exports.ASSISTANT_SECTIONS = [
    { key: 'quotes', label: 'Quotes', description: 'Quotes and their saved details.' },
    { key: 'draft_quotes', label: 'Draft quotes', description: 'Quotes still being prepared, separate from the Quotes setting.' },
    { key: 'orders', label: 'Orders', description: 'Material orders and their details.' },
    { key: 'invoices', label: 'Invoices', description: 'Invoices and their saved details.' },
    { key: 'components', label: 'Components', description: 'Your component library and saved inputs.' },
    { key: 'customers', label: 'Customers', description: 'Customer records and contact details.' },
    { key: 'emails', label: 'Emails', description: 'Future email tools. Sending will always need confirmation.' },
    { key: 'billing', label: 'Billing', description: 'Future billing access only. No billing tools are enabled by this setting.' },
    { key: 'settings', label: 'Settings', description: 'Future settings access only. No settings tools are enabled by this setting.' },
];
exports.PERMISSION_LEVELS = [
    { value: 'hidden', label: 'Hidden' },
    { value: 'read_only', label: 'View' },
    { value: 'edit', label: 'Edit' },
];
exports.DEFAULT_SECTION_PERMISSIONS = Object.freeze({
    quotes: 'read_only',
    draft_quotes: 'read_only',
    orders: 'read_only',
    invoices: 'read_only',
    components: 'read_only',
    customers: 'read_only',
    emails: 'hidden',
    billing: 'hidden',
    settings: 'hidden',
});
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isPermissionLevel(value) {
    return exports.PERMISSION_LEVELS.some((level) => level.value === value);
}
/** Strict, complete map. Missing/unknown keys never silently receive a grant. */
function parseSectionPermissions(value) {
    if (!isRecord(value) || Object.keys(value).length !== exports.ASSISTANT_SECTIONS.length)
        return null;
    const result = { ...exports.DEFAULT_SECTION_PERMISSIONS };
    for (const section of exports.ASSISTANT_SECTIONS) {
        if (!Object.prototype.hasOwnProperty.call(value, section.key))
            return null;
        const level = value[section.key];
        if (!isPermissionLevel(level))
            return null;
        result[section.key] = level;
    }
    return result;
}
function permissionsEqual(a, b) {
    return exports.ASSISTANT_SECTIONS.every(({ key }) => a[key] === b[key]);
}
function isPermissionRevision(value) {
    // SQL int4, with room for the next revision. No parsing of client strings.
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 2147483647;
}
/** Decode the new RPC contract at the transport boundary, not a blind cast. */
function parsePermissionSnapshot(value) {
    if (!isRecord(value) || !isCompanyId(value.company_id))
        return null;
    const permissions = parseSectionPermissions(value.permissions);
    if (!permissions || !isPermissionRevision(value.revision) || typeof value.can_manage !== 'boolean')
        return null;
    if (value.source !== 'default' && value.source !== 'saved')
        return null;
    const updatedAt = value.updated_at;
    if (updatedAt !== null && (typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt))))
        return null;
    if (value.source === 'default' && (value.revision !== 0 || updatedAt !== null || !permissionsEqual(permissions, exports.DEFAULT_SECTION_PERMISSIONS)))
        return null;
    if (value.source === 'saved' && (value.revision < 1 || updatedAt === null))
        return null;
    return {
        companyId: value.company_id,
        permissions,
        revision: value.revision,
        source: value.source,
        updatedAt,
        canManage: value.can_manage,
    };
}
function isCompanyId(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function parseSavePermissionsInput(value) {
    if (!isRecord(value) || Object.keys(value).length !== 3 || !isCompanyId(value.expectedCompanyId))
        return null;
    const permissions = parseSectionPermissions(value.permissions);
    if (!permissions || !isPermissionRevision(value.expectedRevision) || value.expectedRevision >= 2147483646)
        return null;
    return { permissions, expectedRevision: value.expectedRevision, expectedCompanyId: value.expectedCompanyId };
}
function permissionFailure(error) {
    switch (error?.code) {
        case 'PGRST202': // Missing RPC in the PostgREST schema cache.
        case 'PGRST205': // Missing relation in the schema cache.
        case '42883':
        case '42P01':
            return { ok: false, code: 'migration_required', error: 'V2 permission storage is not ready. Your current assistant settings are unchanged. Ask your administrator to apply the P0 migration.' };
        case '42501':
            return { ok: false, code: 'forbidden', error: 'Your workspace or access may have changed, or V2 setup is unavailable here. Only a workspace owner or admin can save them.' };
        case '22023':
            return { ok: false, code: 'invalid', error: 'Choose Hidden, View or Edit for every section, then try again.' };
        case '40001':
            return { ok: false, code: 'conflict', error: 'Someone saved a newer version. Your choices are still on screen. Reload the saved permissions before making a new change.' };
        default:
            return { ok: false, code: 'unavailable', error: 'Could not load or confirm permissions. Any choices you made are still on screen. Reload the saved version before retrying.' };
    }
}

},"app/lib/smart-assistant/tasks/contracts.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyTaskSnapshot = void 0;
exports.parseTaskView = parseTaskView;
/** Task metadata is NOT run state, entity authority or mutation approval. */
const section_permissions_1 = require("app/lib/smart-assistant/section-permissions.ts");
const contracts_1 = require("app/lib/smart-assistant/v2/contracts.ts");
const date = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
function parseTaskView(value) {
    if (!(0, section_permissions_1.isRecord)(value) || !(0, contracts_1.isUuid)(value.id) || !Number.isSafeInteger(value.version) || Number(value.version) < 1
        || !['open', 'awaiting_input', 'answered', 'closed'].includes(String(value.status))
        || typeof value.label !== 'string' || value.label.length > 200 || /[\u0000-\u001f]/u.test(value.label)
        || !(0, contracts_1.isUuid)(value.lastRunId) || !date(value.startedAt) || !date(value.updatedAt) || !date(value.expiresAt)
        || ![null, 'solved', 'abandoned', 'superseded'].includes(value.closure) || typeof value.boundary !== 'boolean')
        return null;
    return value;
}
const emptyTaskSnapshot = () => ({ task: null, resolution: null, runIds: [], pendingMessage: null });
exports.emptyTaskSnapshot = emptyTaskSnapshot;

},"app/(auth)/[workspaceSlug]/quotes/actions.ts":function(require,module,exports){
exports.updateQuoteMargins=async(id,settings)=>{window.fx.calls.push({type:'margins',id,settings});await window.fx.wait('margins');if(window.fx.config.marginFail)throw Error('fixture margin failure');};exports.confirmQuote=async(id)=>{window.fx.calls.push({type:'confirm',id});await window.fx.wait('confirm');if(window.fx.config.confirmFail)throw Error('fixture confirmation failure');};
},"app/lib/trades/labels.ts":function(require,module,exports){
"use strict";
/**
 * Trade-aware UI labels - single source of truth for all copy that varies by trade.
 *
 * Each new trade is one entry in TRADE_LABELS plus an enum value in the DB.
 * The rest of the UI picks up the right copy automatically via getTradeLabels().
 *
 * Fields are grouped by usage context: area labels, modal copy, takeoff
 * instructions, quote builder, customer quote, measurement type overrides.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRADE_LABELS = void 0;
exports.getTradeLabels = getTradeLabels;
exports.TRADE_LABELS = {
    plumbing: {
        tradeLabel: 'Plumbing',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Fall / Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Bathroom, Kitchen, Ground Floor',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Job Areas',
        firstAreaInstructionsBody: 'You can optionally draw areas to break the job into zones (floors, rooms, sections). ' +
            'Or skip this and measure pipe runs and fittings directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Line / Multi-Line tools for pipe runs. ' +
            'Use the Curved Line tool for curved or concealed pipe routes. ' +
            'Use Point for fixtures, valves, and fittings.',
        needAreaPrompt: 'Do you want to define a job area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Plumbing Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Pipe Runs',
            curved_line: 'Curved Pipe Run',
            hours_days: 'Hours / Days',
            count: 'Count',
            volume: 'Volume',
        },
    },
    electrical: {
        tradeLabel: 'Electrical',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Ground Floor, Roof Space',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Job Areas',
        firstAreaInstructionsBody: 'You can optionally draw areas to break the job into zones (floors, circuits, sections). ' +
            'Or skip this and measure cable runs and fittings directly.',
        firstAreaConfirmCta: "Yes, add an area",
        toolGuidanceNote: 'Use the Line / Multi-Line tools for cable runs and conduit. ' +
            'Use the Curved Line tool for curved cable paths. ' +
            'Use Point for outlets, fittings, and panels.',
        needAreaPrompt: 'Do you want to define a job area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Electrical Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Cable Runs',
            curved_line: 'Curved Cable Run',
            hours_days: 'Hours / Days',
            count: 'Count',
        },
    },
    roofing: {
        tradeLabel: 'Roofing',
        featureLabel: 'Flashings',
        featureLabelSingular: 'Flashing',
        areaPluralLabel: 'Roof Areas',
        areaSingularLabel: 'Roof Area',
        addAreaCta: 'Add Roof Area',
        pitchRequired: true,
        createAreaModalTitle: 'Create Roof Area',
        areaNamePlaceholder: 'e.g. Main Roof',
        areaIsOptional: false,
        firstAreaInstructionsTitle: 'Next: Create Your First Roof Area',
        firstAreaInstructionsBody: 'Before measuring components, you must define at least one roof area with a pitch angle. ' +
            'Click the Area button, draw around the roof outline, then enter a name and pitch angle.',
        firstAreaConfirmCta: "Got it, let's create a roof area!",
        toolGuidanceNote: null,
        needAreaPrompt: 'Do you want to measure a roof area first?',
        optionalAreaConfirmCta: 'Yes, add a roof area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Roof Areas',
        emptyAreaGuardMessage: 'A quote needs at least one roof area and one main component before it can be saved. ' +
            "We'll take you back to Roof Areas so you can add one.",
        customerQuoteSectionLabel: 'Roof Areas',
        measurementTypeLabels: {},
    },
    cladding: {
        tradeLabel: 'Cladding',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Wall Areas',
        areaSingularLabel: 'Wall Area',
        addAreaCta: 'Add Wall Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Wall Area',
        areaNamePlaceholder: 'e.g. North Elevation',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Next: Define Your Wall Areas',
        firstAreaInstructionsBody: 'Define your wall areas before measuring components. ' +
            'Use the Area tool to trace elevations directly, or use the Line / Multi-Line tools ' +
            'for plan views - make sure your components are set up with Wall Length × Height.',
        firstAreaConfirmCta: "Got it, let's add a wall area!",
        toolGuidanceNote: 'Use the Area tool for elevation plans, or the Line / Multi-Line tools for plan view ' +
            '(make sure your components are set up with Wall Length × Height).',
        needAreaPrompt: 'Do you want to measure a wall area first?',
        optionalAreaConfirmCta: 'Yes, add a wall area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Wall Areas',
        emptyAreaGuardMessage: 'A quote needs at least one wall area and one main component before it can be saved. ' +
            "We'll take you back to Wall Areas so you can add one.",
        customerQuoteSectionLabel: 'Wall Areas',
        measurementTypeLabels: {
            multi_lineal_lxh: 'Wall Length × Height',
            length_x_height: 'Wall Height × Length',
        },
    },
    generic: {
        tradeLabel: 'Generic',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Zone A',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Areas',
        firstAreaInstructionsBody: 'For area-based components you can draw an area now. ' +
            'For lineal or count-based work you can skip this and measure directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: null,
        needAreaPrompt: 'Do you want to measure an area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one area and one main component before it can be saved. ' +
            "We'll take you back to Areas so you can add one.",
        customerQuoteSectionLabel: 'Areas',
        measurementTypeLabels: {},
    },
    landscaping: {
        tradeLabel: 'Landscaping',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Front Garden, Driveway, Patio',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Job Areas',
        firstAreaInstructionsBody: 'You can draw areas to break the job into zones (garden beds, paving, driveway, lawn). ' +
            'Or skip this and measure paths, edging, and items directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for gardens, lawns, paving, and decking. ' +
            'Use the Line / Multi-Line tools for paths, edging, retaining walls, and fence lines. ' +
            'Use the Curved Line tool for curved garden edges or winding paths. ' +
            'Use Point for trees, planters, fittings, and items priced per unit.',
        needAreaPrompt: 'Do you want to define a job area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Landscaping Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Lines',
            curved_line: 'Curved Line',
            hours_days: 'Hours / Days',
            count: 'Count',
            volume: 'Volume',
            irregular_area: 'Irregular Area',
        },
    },
    flooring: {
        tradeLabel: 'Flooring',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Fall / Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Living Room, Hallway, Kitchen',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Floor Areas',
        firstAreaInstructionsBody: 'Draw each floor area you are quoting (room by room, or as a single open zone). ' +
            'Or skip this and measure components directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for room floor areas. ' +
            'Use the Line / Multi-Line tools for skirting, edge trims, and transition strips. ' +
            'Use Point for fittings and items priced per unit.',
        needAreaPrompt: 'Do you want to measure a floor area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Flooring Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Trim Runs',
            curved_line: 'Curved Trim Run',
            hours_days: 'Hours / Days',
            count: 'Count',
            volume: 'Volume (screed / levelling)',
            irregular_area: 'Irregular Floor Area',
        },
    },
    tiling: {
        tradeLabel: 'Tiling',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Fall / Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Bathroom, Kitchen Splashback',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Tiling Areas',
        firstAreaInstructionsBody: 'Draw your tiling areas - floor zones from a plan, or walls measured directly. ' +
            'For wall tiling from a floor plan, use the Line / Multi-Line tools with components ' +
            'set up as Wall Length × Height.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for floor tiling and direct elevation plans. ' +
            'Use the Line / Multi-Line tools for wall runs in plan view ' +
            '(set components to Wall Length × Height). ' +
            'Use Point for fittings and items priced per unit.',
        needAreaPrompt: 'Do you want to measure a tiling area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Tiling Works',
        measurementTypeLabels: {
            multi_lineal_lxh: 'Wall Length × Height',
            length_x_height: 'Wall Height × Length',
            multi_lineal: 'Multiple Trim Runs',
            curved_line: 'Curved Trim Run',
            hours_days: 'Hours / Days',
            count: 'Count',
            irregular_area: 'Irregular Area',
        },
    },
    foundations: {
        tradeLabel: 'Foundations',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Main Slab, Garage Footing',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Foundation Areas',
        firstAreaInstructionsBody: 'Draw the slab outline or excavation footprint. ' +
            'Use the Line tools to trace footings, beams, and the perimeter directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for slab footprints and excavation zones. ' +
            'Use the Line / Multi-Line tools for footings, ring beams, and perimeter runs. ' +
            'Use Point for piers, pads, and items priced per unit.',
        needAreaPrompt: 'Do you want to measure a slab or excavation area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Foundation Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Footings',
            curved_line: 'Curved Footing',
            hours_days: 'Hours / Days',
            count: 'Count',
            volume: 'Volume (concrete / excavation)',
            irregular_area: 'Irregular Slab Area',
        },
    },
    insulation: {
        tradeLabel: 'Insulation',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Ceiling, Loft, Wall North',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Insulation Areas',
        firstAreaInstructionsBody: 'Draw each area you are insulating - ceiling, floor, or walls. ' +
            'For wall insulation from a floor plan use the Line / Multi-Line tools with ' +
            'components set up as Wall Length × Height.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for ceiling, floor, and elevation areas. ' +
            'Use the Line / Multi-Line tools for wall insulation in plan view ' +
            '(set components to Wall Length × Height). ' +
            'Enable rafter pitch on roof / loft components that follow the slope.',
        needAreaPrompt: 'Do you want to measure an insulation area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Insulation Works',
        measurementTypeLabels: {
            multi_lineal_lxh: 'Wall Length × Height',
            length_x_height: 'Wall Height × Length',
            multi_lineal: 'Multiple Edge Runs',
            hours_days: 'Hours / Days',
            count: 'Count (bags / rolls / batts)',
            irregular_area: 'Irregular Area',
        },
    },
    painting: {
        tradeLabel: 'Painting',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Living Room, External North Wall',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Painting Areas',
        firstAreaInstructionsBody: 'Draw each area you are painting - ceiling, walls, or external elevations. ' +
            'For wall painting from a floor plan use the Line / Multi-Line tools with ' +
            'components set up as Wall Length × Height.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for ceilings and direct elevation plans. ' +
            'Use the Line / Multi-Line tools for walls in plan view ' +
            '(set components to Wall Length × Height). ' +
            'Use the Line tools for skirtings, architraves, and trim.',
        needAreaPrompt: 'Do you want to measure a painting area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Painting Works',
        measurementTypeLabels: {
            multi_lineal_lxh: 'Wall Length × Height',
            length_x_height: 'Wall Height × Length',
            multi_lineal: 'Multiple Trim Runs',
            curved_line: 'Curved Trim Run',
            hours_days: 'Hours / Days',
            count: 'Count',
            irregular_area: 'Irregular Area',
        },
    },
    fencing: {
        tradeLabel: 'Fencing',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Boundary, Paddock',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Fencing Job',
        firstAreaInstructionsBody: 'For most fencing jobs you can skip the area step and measure fence runs directly. ' +
            'Or draw an area first if you want to record the enclosed zone.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Line / Multi-Line tools for fence runs. ' +
            'Use the Curved Line tool for curved boundaries. ' +
            'Use Point for posts, gates, and fittings priced per unit.',
        needAreaPrompt: 'Do you want to define an area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Fencing Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Fence Runs',
            multi_lineal_lxh: 'Panel Length × Height',
            length_x_height: 'Panel Height × Length',
            curved_line: 'Curved Fence Run',
            hours_days: 'Hours / Days',
            count: 'Count (posts / gates)',
            irregular_area: 'Irregular Area',
        },
    },
    concrete: {
        tradeLabel: 'Concrete',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Fall / Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Driveway, Garage Slab, Patio',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Concrete Areas',
        firstAreaInstructionsBody: 'Draw the slab or pour outline. ' +
            'Use the Line tools to trace kerbs, edges, expansion joints, and sawn cuts directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for slab footprints. ' +
            'Use the Line / Multi-Line tools for kerbs, edge restraints, joints, and sawn cuts. ' +
            'Use the Curved Line tool for curved kerbs and edges. ' +
            'Use Point for items priced per unit.',
        needAreaPrompt: 'Do you want to measure a slab area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Concrete Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Kerb / Edge Runs',
            curved_line: 'Curved Kerb / Edge',
            hours_days: 'Hours / Days',
            count: 'Count',
            volume: 'Volume (concrete pour)',
            irregular_area: 'Irregular Slab Area',
        },
    },
    solar: {
        tradeLabel: 'Solar',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Tilt (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Main Roof, North Array, Carport',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Installation Areas',
        firstAreaInstructionsBody: 'Draw each area where panels or equipment will be installed. ' +
            'Or skip this and measure runs and items directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for roof or ground-mount panel arrays. ' +
            'Use the Line / Multi-Line tools for cable and conduit runs. ' +
            'Use Point for inverters, isolators, meters, and items priced per unit.',
        needAreaPrompt: 'Do you want to define an installation area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Solar Installation',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Cable / Conduit Runs',
            curved_line: 'Curved Cable Run',
            hours_days: 'Hours / Days',
            count: 'Count (panels / inverters / fittings)',
            volume: 'Volume',
        },
    },
    construction: {
        tradeLabel: 'Construction',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Zone A, Ground Floor, Extension',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Areas',
        firstAreaInstructionsBody: 'For area-based components you can draw an area now. ' +
            'For lineal or count-based work you can skip this and measure directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for room or zone outlines. ' +
            'Use the Line / Multi-Line tools for lineal runs (footings, framing, trim, fence lines). ' +
            'Use the Curved Line tool for curved paths or edges. ' +
            'Use Point for items priced per unit. ' +
            'Enable pitch on individual components when measuring roof work from plan view.',
        needAreaPrompt: 'Do you want to measure an area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one area and one main component before it can be saved. ' +
            "We'll take you back to Areas so you can add one.",
        customerQuoteSectionLabel: 'Construction Works',
        measurementTypeLabels: {},
    },
};
/**
 * Safe accessor: falls back to roofing labels for unknown / legacy trade
 * values so a stale database row never breaks the UI.
 */
function getTradeLabels(trade) {
    if (trade === 'cladding')
        return exports.TRADE_LABELS.cladding;
    if (trade === 'generic')
        return exports.TRADE_LABELS.generic;
    if (trade === 'electrical')
        return exports.TRADE_LABELS.electrical;
    if (trade === 'plumbing')
        return exports.TRADE_LABELS.plumbing;
    if (trade === 'landscaping')
        return exports.TRADE_LABELS.landscaping;
    if (trade === 'flooring')
        return exports.TRADE_LABELS.flooring;
    if (trade === 'tiling')
        return exports.TRADE_LABELS.tiling;
    if (trade === 'foundations')
        return exports.TRADE_LABELS.foundations;
    if (trade === 'insulation')
        return exports.TRADE_LABELS.insulation;
    if (trade === 'painting')
        return exports.TRADE_LABELS.painting;
    if (trade === 'fencing')
        return exports.TRADE_LABELS.fencing;
    if (trade === 'concrete')
        return exports.TRADE_LABELS.concrete;
    if (trade === 'construction')
        return exports.TRADE_LABELS.construction;
    if (trade === 'solar')
        return exports.TRADE_LABELS.solar;
    return exports.TRADE_LABELS.roofing;
}

},"app/lib/pricing/engine.ts":function(require,module,exports){
"use strict";
// QuoteCore+ v2 Pricing Engine
// Unified calculation: dual input → pitch → waste → costs
Object.defineProperty(exports, "__esModule", { value: true });
exports.rafterPitchFactor = rafterPitchFactor;
exports.hipValleyPitchFactor = hipValleyPitchFactor;
exports.pitchFactor = pitchFactor;
exports.applyWaste = applyWaste;
exports.applyPitchAndWaste = applyPitchAndWaste;
exports.computeRoofArea = computeRoofArea;
exports.totalRoofArea = totalRoofArea;
exports.computeMaterialCostByStrategy = computeMaterialCostByStrategy;
exports.computePackCount = computePackCount;
exports.computeQuoteTotals = computeQuoteTotals;
// ─── Pitch Calculations ──────────────────────────────
const RAD = Math.PI / 180;
/** Rafter pitch factor: actual = plan / cos(pitch) */
function rafterPitchFactor(degrees) {
    if (!degrees || degrees <= 0 || degrees >= 90)
        return 1;
    return 1 / Math.cos(degrees * RAD);
}
/** Hip/Valley pitch factor: compound angle for 45° hip/valley
 *  hip_angle = arctan(tan(pitch) × cos(45°))
 *  hip_factor = 1 / cos(hip_angle)
 *  This is equivalent to sqrt(1 + tan²(pitch)/2) — a standard roofing formula. */
function hipValleyPitchFactor(degrees) {
    if (!degrees || degrees <= 0 || degrees >= 90)
        return 1;
    const tangent = Math.tan(degrees * RAD);
    return Math.sqrt(1 + (tangent * tangent) / 2);
}
/** Get pitch factor based on pitch type */
function pitchFactor(degrees, pitchType = 'rafter') {
    if (pitchType === 'valley_hip')
        return hipValleyPitchFactor(degrees);
    if (pitchType === 'rafter')
        return rafterPitchFactor(degrees);
    return 1;
}
// ─── Waste ───────────────────────────────────────────
function applyWaste(value, wasteType, wastePercent, wasteFixed) {
    switch (wasteType) {
        case 'percent': return value * (1 + (wastePercent || 0) / 100);
        case 'fixed': return value + (wasteFixed || 0);
        // fixed_per_segment: in manual entry (1 segment per entry) this is
        // equivalent to plain fixed. The digital takeoff path converts
        // multi-segment counts before calling this function; this fallback
        // ensures manual entries still get waste applied.
        case 'fixed_per_segment': return value + (wasteFixed || 0);
        default: return value;
    }
}
/** Apply pitch then waste to a raw plan value */
function applyPitchAndWaste(rawValue, isPlan, pitchType, pitchDegrees, wasteType, wastePercent, wasteFixed) {
    let pitchFactorUsed = 1;
    let afterPitch = rawValue;
    if (isPlan && pitchType !== 'none' && pitchDegrees > 0) {
        pitchFactorUsed = pitchFactor(pitchDegrees, pitchType);
        afterPitch = rawValue * pitchFactorUsed;
    }
    const afterWaste = applyWaste(afterPitch, wasteType, wastePercent, wasteFixed);
    return { afterPitch, afterWaste, pitchFactorUsed };
}
// ─── Roof Area ───────────────────────────────────────
function computeRoofArea(area) {
    if (area.inputMode === 'final')
        return area.finalValueSqm ?? 0;
    let planSqm = area.calcPlanSqm ?? 0;
    if (!planSqm && area.calcWidthM && area.calcLengthM)
        planSqm = area.calcWidthM * area.calcLengthM;
    return planSqm * rafterPitchFactor(area.calcPitchDegrees ?? 0);
}
function totalRoofArea(areas) {
    return areas.reduce((sum, a) => sum + (a.computedSqm ?? computeRoofArea(a)), 0);
}
/**
 * Computes material cost for a component given its purchasing strategy.
 *
 * - `per_unit`: classic `qty * cost_per_unit` (today's behaviour).
 * - `per_pack_length` / `per_pack_area` / `per_pack_volume`: roll/pack
 *   purchases. Cost = `ceil(qty / pack_size) * pack_price`. Round-up
 *   captures the next purchasable unit. Used when the user buys cable in
 *   20m rolls, underlay in 50m² rolls, or concrete in 5m³ packs.
 * - `per_pack_coverage`: paint-style. `pack_size` is the physical pack
 *   quantity (e.g. 20L) for display only; `pack_coverage_m2` is what the
 *   pack actually covers. Cost = `ceil(area_m2 / pack_coverage_m2) * pack_price`.
 *
 * Returns { cost: 0, packDataMissing: true } for nonsense inputs rather than
 * throwing - the DB ck_component_library_pack_values_positive CHECK already
 * rejects bad data on write, so this is a defensive belt at the math layer.
 * Callers should check `packDataMissing` to warn the user (e.g. ⚠ badge in
 * the quote builder) so quotes don't silently ship with £0 material cost.
 */
function computeMaterialCostByStrategy(args) {
    const { strategy, totalQuantity, materialRate, packPrice, packSize, packCoverageM2 } = args;
    if (totalQuantity <= 0)
        return { cost: 0, packDataMissing: false };
    switch (strategy) {
        case 'per_unit': {
            return { cost: totalQuantity * materialRate, packDataMissing: false };
        }
        case 'per_pack_length':
        case 'per_pack_area':
        case 'per_pack_volume': {
            if (!packPrice || !packSize || packSize <= 0)
                return { cost: 0, packDataMissing: true };
            const packs = Math.ceil(totalQuantity / packSize);
            return { cost: packs * packPrice, packDataMissing: false };
        }
        case 'per_pack_coverage': {
            if (!packPrice || !packCoverageM2 || packCoverageM2 <= 0)
                return { cost: 0, packDataMissing: true };
            const packs = Math.ceil(totalQuantity / packCoverageM2);
            return { cost: packs * packPrice, packDataMissing: false };
        }
    }
}
/**
 * Convenience: returns the number of packs the user will need to buy
 * (useful for UI worked-example strings like "6 × 50m² rolls"). Returns 0
 * for per_unit (the concept doesn't apply) or for missing pack data.
 */
function computePackCount(args) {
    const { strategy, totalQuantity, packSize, packCoverageM2 } = args;
    if (totalQuantity <= 0)
        return 0;
    switch (strategy) {
        case 'per_unit':
            return 0;
        case 'per_pack_length':
        case 'per_pack_area':
        case 'per_pack_volume':
            if (!packSize || packSize <= 0)
                return 0;
            return Math.ceil(totalQuantity / packSize);
        case 'per_pack_coverage':
            if (!packCoverageM2 || packCoverageM2 <= 0)
                return 0;
            return Math.ceil(totalQuantity / packCoverageM2);
    }
}
// ─── Quote Totals ────────────────────────────────────
// Uses material_cost and labour_cost already stored on components (entry-based)
// The per-component pricing_strategy switch lives in computeMaterialCostByStrategy
// above; recalc helpers call it before writing material_cost back to the row.
function computeQuoteTotals(components, context) {
    const totalMaterials = components.reduce((sum, c) => sum + (c.materialCost ?? 0), 0);
    const totalLabour = components.reduce((sum, c) => sum + (c.labourCost ?? 0), 0);
    const subtotal = totalMaterials + totalLabour;
    const materialMargin = totalMaterials * ((context.materialMarginPct || 0) / 100);
    const labourMargin = totalLabour * ((context.labourMarginPct || 0) / 100);
    const subtotalWithMargins = subtotal + materialMargin + labourMargin;
    const tax = subtotalWithMargins * ((context.taxRate || 0) / 100);
    return { totalMaterials, totalLabour, subtotal, materialMargin, labourMargin, subtotalWithMargins, tax, grandTotal: subtotalWithMargins + tax };
}

},"app/lib/measurements/conversions.ts":function(require,module,exports){
"use strict";
// Conversion utilities for metric / imperial measurement systems.
// All database values are stored in METRIC (m, m²) as the canonical form.
//
// Imperial comes in two area flavours users can pick from:
//   - Square Feet (ft²)         used by US roofers
//   - Roofing Squares (RS)      used by NZ/AU/UK roofers; 1 RS = 100 ft² = 9.2903 m²
// Linear is always in feet for both Imperial flavours.
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertLinear = convertLinear;
exports.convertLinearRate = convertLinearRate;
exports.convertLinearToMetric = convertLinearToMetric;
exports.convertAreaFt2 = convertAreaFt2;
exports.convertAreaFt2Rate = convertAreaFt2Rate;
exports.convertAreaFt2ToMetric = convertAreaFt2ToMetric;
exports.convertArea = convertArea;
exports.convertAreaRs = convertAreaRs;
exports.convertAreaRate = convertAreaRate;
exports.convertAreaToMetric = convertAreaToMetric;
exports.convertVolumeFt3 = convertVolumeFt3;
exports.convertVolumeFt3ToMetric = convertVolumeFt3ToMetric;
exports.volumeInputToMetric = volumeInputToMetric;
exports.mmToInches = mmToInches;
exports.inchesToMm = inchesToMm;
exports.linearInputToMetric = linearInputToMetric;
exports.areaInputToMetric = areaInputToMetric;
const types_1 = require("app/lib/types.ts");
// -- Conversion constants ----------------------------------------------------
const M_TO_FT = 3.28084;
const SQM_TO_FT2 = 10.7639;
const SQM_TO_RS = 0.107639; // 1 m² = 0.107639 RS  (= 1/9.2903)
const MM_PER_INCH = 25.4; // exact by definition (since 1959)
// -- Linear (m -> ft) --------------------------------------------------------
/** Display a linear measurement (stored in meters) in feet, 2dp. */
function convertLinear(meters) {
    return Number((meters * M_TO_FT).toFixed(2));
}
/** Convert a linear rate ($/m -> $/ft), 2dp. */
function convertLinearRate(ratePerMeter) {
    return Number((ratePerMeter / M_TO_FT).toFixed(2));
}
/** Customer typed feet, store as meters. */
function convertLinearToMetric(feet) {
    return feet / M_TO_FT;
}
// -- Area (m² -> ft²) --------------------------------------------------------
/** Display an area (stored in m²) in square feet, 2dp. */
function convertAreaFt2(sqm) {
    return Number((sqm * SQM_TO_FT2).toFixed(2));
}
/** Convert an area rate ($/m² -> $/ft²), 4dp (rates can be small per ft²). */
function convertAreaFt2Rate(ratePerSqm) {
    return Number((ratePerSqm / SQM_TO_FT2).toFixed(4));
}
/** Customer typed ft², store as m². */
function convertAreaFt2ToMetric(ft2) {
    return ft2 / SQM_TO_FT2;
}
// -- Area (m² -> Roofing Squares) --------------------------------------------
/** Display an area (stored in m²) in Roofing Squares, 3dp. Returned as string for backwards compat. */
function convertArea(sqm) {
    return (sqm * SQM_TO_RS).toFixed(3);
}
/** Numeric variant of convertArea for callers that want to keep doing math. */
function convertAreaRs(sqm) {
    return Number((sqm * SQM_TO_RS).toFixed(3));
}
/** Convert an area rate ($/m² -> $/RS), 2dp. */
function convertAreaRate(ratePerSqm) {
    return Number((ratePerSqm / SQM_TO_RS).toFixed(2));
}
/** Customer typed RS, store as m². */
function convertAreaToMetric(roofingSquares) {
    return roofingSquares / SQM_TO_RS;
}
// -- Volume (m³ -> ft³) ------------------------------------------------------
const SQM_TO_CUBIC_FT = SQM_TO_FT2 * M_TO_FT; // m³ -> ft³  (≈35.3147)
/** Display a volume (stored in m³) in cubic feet, 2dp. */
function convertVolumeFt3(cubicM) {
    return Number((cubicM * SQM_TO_CUBIC_FT).toFixed(2));
}
/** Customer typed ft³, store as m³. */
function convertVolumeFt3ToMetric(ft3) {
    return ft3 / SQM_TO_CUBIC_FT;
}
/**
 * Convert a volume value typed by the user (in their measurement system) into
 * canonical metric storage (m³). Imperial users both flavours use ft³.
 */
function volumeInputToMetric(input, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return input;
    return convertVolumeFt3ToMetric(input);
}
// -- Small-unit (mm ↔ in) ----------------------------------------------------
//
// Used by the flashings drawing tool, where canvas measurements are stored
// in mm but Imperial users want to see and enter inches. 1 inch = 25.4 mm
// exactly (international inch since 1959).
/** Display a mm value in inches, 2dp. */
function mmToInches(mm) {
    return Number((mm / MM_PER_INCH).toFixed(2));
}
/** Customer typed inches, store as mm. Keeps full precision; callers may round. */
function inchesToMm(inches) {
    return inches * MM_PER_INCH;
}
// -- Polymorphic helpers (recommended for new call sites) --------------------
/**
 * Convert a linear value typed by the user (in their measurement system) into
 * canonical metric storage (meters).
 */
function linearInputToMetric(input, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return input;
    return convertLinearToMetric(input);
}
/**
 * Convert an area value typed by the user (in their measurement system) into
 * canonical metric storage (m²). Handles ft² vs Roofing Squares.
 */
function areaInputToMetric(input, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return input;
    if (norm === 'imperial_ft')
        return convertAreaFt2ToMetric(input);
    return convertAreaToMetric(input); // imperial_rs
}

},"app/lib/types.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMeasurementSystem = normalizeMeasurementSystem;
exports.unitForMeasurement = unitForMeasurement;
exports.wasteAmountSuffix = wasteAmountSuffix;
exports.entryLabel = entryLabel;
exports.addMoreLabel = addMoreLabel;
exports.measurementTypeLabel = measurementTypeLabel;
/** Narrow a possibly-legacy MeasurementSystem to the canonical 4-value set callers should branch on. */
function normalizeMeasurementSystem(system) {
    if (system === 'imperial_ft')
        return 'imperial_ft';
    // Legacy 'imperial' rows were always Roofing Squares in practice.
    if (system === 'imperial' || system === 'imperial_rs')
        return 'imperial_rs';
    return 'metric';
}
/**
 * Metric-only unit label for a measurement type. Used by system-agnostic
 * contexts like the component library (which spans every quote regardless of
 * unit system).
 *
 * NOTE: For per-quote rendering use `getUnitLabel(measurementType, system)` from
 * `@/app/lib/measurements/displayHelpers` instead, which knows how to render
 * ft, ft², and Roofing Squares for Imperial quotes.
 */
function unitForMeasurement(mt) {
    switch (mt) {
        case 'area': return 'm²';
        case 'lineal': return 'm';
        case 'linear': return 'm'; // legacy alias
        case 'multi_lineal': return 'm';
        case 'multi_lineal_lxh': return 'm\u00b2';
        case 'quantity': return 'each';
        case 'count': return 'each'; // Phase 2 alias
        case 'fixed': return 'fixed';
        case 'length_x_height': return 'm²'; // length × component height
        case 'volume': return 'm³';
        case 'volume_3d': return 'm³'; // true 3D: L × W × D
        case 'length_x_height_freestyle': return 'm²';
        case 'multi_lineal_lxh_freestyle': return 'm²';
        case 'hours_days': return 'hr'; // unit refined by component config
        case 'curved_line': return 'm';
        case 'irregular_area': return 'm²';
        default: return '';
    }
}
function wasteAmountSuffix(wt, mt) {
    if (wt === 'percent')
        return '%';
    if (wt === 'fixed' || wt === 'fixed_per_segment')
        return unitForMeasurement(mt);
    return '';
}
function entryLabel(mt) {
    switch (mt) {
        case 'area': return 'area';
        case 'lineal':
        case 'linear':
        case 'multi_lineal':
        case 'multi_lineal_lxh':
        case 'curved_line': return 'length';
        case 'quantity':
        case 'count': return 'items';
        case 'fixed': return 'value';
        case 'length_x_height': return 'length';
        case 'volume': return 'area';
        case 'volume_3d': return 'L × W × D';
        case 'length_x_height_freestyle': return 'length × height';
        case 'multi_lineal_lxh_freestyle': return 'length × height';
        case 'hours_days': return 'time';
        case 'irregular_area': return 'area';
        default: return '';
    }
}
function addMoreLabel(mt) {
    switch (mt) {
        case 'area': return 'Add more areas';
        case 'lineal':
        case 'linear':
        case 'multi_lineal':
        case 'multi_lineal_lxh':
        case 'curved_line': return 'Add more lengths';
        case 'quantity':
        case 'count': return 'Add more items';
        case 'fixed': return 'Add entry';
        case 'length_x_height': return 'Add more lengths';
        case 'volume': return 'Add more areas';
        case 'volume_3d': return 'Add volume entry';
        case 'length_x_height_freestyle': return 'Add more lengths';
        case 'multi_lineal_lxh_freestyle': return 'Add more lengths';
        case 'hours_days': return 'Add more time';
        case 'irregular_area': return 'Add more areas';
        default: return 'Add entry';
    }
}
/**
 * Human-friendly display name for a measurement type, with optional unit system
 * for unit suffix. Used wherever the raw enum value would be shown to users.
 */
function measurementTypeLabel(mt, system) {
    const norm = system ? normalizeMeasurementSystem(system) : 'metric';
    const areaUnit = norm === 'metric' ? 'm²' : norm === 'imperial_ft' ? 'ft²' : 'RS';
    const linealUnit = norm === 'metric' ? 'm' : 'ft';
    const volumeUnit = norm === 'metric' ? 'm³' : 'ft³';
    switch (mt) {
        case 'area': return `Area (${areaUnit})`;
        case 'lineal': return `Linear (${linealUnit})`;
        case 'linear': return `Linear (${linealUnit})`;
        case 'quantity': return 'Quantity';
        case 'fixed': return 'Fixed';
        case 'length_x_height': return `Length × Height (${areaUnit})`;
        case 'volume': return `Volume - Preset Depth (${volumeUnit})`;
        case 'volume_3d': return `Volume (${volumeUnit})`;
        case 'hours_days': return 'Hours / Days';
        case 'count': return 'Count';
        case 'curved_line': return `Curved Line (${linealUnit})`;
        case 'irregular_area': return `Irregular Area (${areaUnit})`;
        case 'multi_lineal': return `Linear: Multi-Length (${linealUnit})`;
        case 'multi_lineal_lxh': return `Length × Height: Multi-Length (${areaUnit})`;
        case 'length_x_height_freestyle': return `Length × Height: Custom (${areaUnit})`;
        case 'multi_lineal_lxh_freestyle': return `Length × Height: Multi-Length Custom (${areaUnit})`;
        default: return String(mt);
    }
}

},"app/lib/measurements/displayHelpers.ts":function(require,module,exports){
"use strict";
// Display formatting helpers for measurements.
// All inputs are in METRIC (canonical storage). Output is formatted for the
// caller's chosen MeasurementSystem.
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLinear = formatLinear;
exports.formatArea = formatArea;
exports.formatVolume = formatVolume;
exports.formatLinearRate = formatLinearRate;
exports.formatAreaRate = formatAreaRate;
exports.getUnitLabel = getUnitLabel;
exports.describeMeasurementSystem = describeMeasurementSystem;
exports.shortMeasurementSystemLabel = shortMeasurementSystemLabel;
const conversions_1 = require("app/lib/measurements/conversions.ts");
const types_1 = require("app/lib/types.ts");
/** Format a linear measurement (stored in meters) with the right unit suffix. */
function formatLinear(meters, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return `${meters.toFixed(2)} m`;
    // Both imperial flavours use feet for linear.
    return `${(0, conversions_1.convertLinear)(meters)} ft`;
}
/** Format an area (stored in m²) with the right unit suffix. */
function formatArea(sqm, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return `${sqm.toFixed(2)} m²`;
    if (norm === 'imperial_ft')
        return `${(0, conversions_1.convertAreaFt2)(sqm)} ft²`;
    return `${(0, conversions_1.convertArea)(sqm)} RS`;
}
/** Format a volume (stored in m³) with the right unit suffix. */
function formatVolume(cubicM, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return `${cubicM.toFixed(3)} m³`;
    return `${(0, conversions_1.convertVolumeFt3)(cubicM)} ft³`;
}
/** Format a linear rate ($/m canonical) with the right per-unit suffix. */
function formatLinearRate(ratePerMeter, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return `$${ratePerMeter.toFixed(2)}/m`;
    return `$${(0, conversions_1.convertLinearRate)(ratePerMeter)}/ft`;
}
/** Format an area rate ($/m² canonical) with the right per-unit suffix. */
function formatAreaRate(ratePerSqm, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return `$${ratePerSqm.toFixed(2)}/m²`;
    if (norm === 'imperial_ft')
        return `$${(0, conversions_1.convertAreaFt2Rate)(ratePerSqm)}/ft²`;
    return `$${(0, conversions_1.convertAreaRate)(ratePerSqm)}/RS`;
}
/** Get just the unit label (no value) for a given measurement type + system. */
function getUnitLabel(measurementType, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    // Area-valued types (store m², display as area)
    if (measurementType === 'area' ||
        measurementType === 'length_x_height' ||
        measurementType === 'multi_lineal_lxh' ||
        measurementType === 'irregular_area') {
        if (norm === 'metric')
            return 'm²';
        if (norm === 'imperial_ft')
            return 'ft²';
        return 'RS';
    }
    // Linear-valued types (store m, display as length)
    if (measurementType === 'lineal' ||
        measurementType === 'multi_lineal' ||
        measurementType === 'curved_line') {
        return norm === 'metric' ? 'm' : 'ft';
    }
    // Volume (Preset Depth) and Volume (L × W × D)
    if (measurementType === 'volume' || measurementType === 'volume_3d') {
        return norm === 'metric' ? 'm³' : 'ft³';
    }
    // Count / fixed / point
    if (measurementType === 'quantity' || measurementType === 'point')
        return 'each';
    return '';
}
/** Human-friendly label for the system itself (used in selectors / settings). */
function describeMeasurementSystem(system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return 'Metric (m, m²)';
    if (norm === 'imperial_ft')
        return 'Imperial - feet & ft²';
    return 'Imperial - feet & Roofing Squares';
}
/** Short label, e.g. for the convert button. */
function shortMeasurementSystemLabel(system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return 'Metric';
    if (norm === 'imperial_ft')
        return 'Imperial (ft²)';
    return 'Imperial (RS)';
}

},"app/(auth)/[workspaceSlug]/quotes/[id]/QuoteNameEditor.tsx":function(require,module,exports){
exports.QuoteNameEditor=({customerName,jobName})=>require('react').createElement('div',null,require('react').createElement('h1',{className:'qb-title'},jobName),require('react').createElement('p',{className:'qb-job-reference'},customerName));
},"app/(auth)/[workspaceSlug]/quotes/[id]/ConfirmQuoteButton.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmQuoteButton = ConfirmQuoteButton;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const actions_1 = require("app/(auth)/[workspaceSlug]/quotes/actions.ts");
const QcButton_1 = require("app/components/ui/v2/QcButton.tsx");
const QcSurface_1 = require("app/components/ui/v2/QcSurface.tsx");
const reviewCompletion_1 = require("app/components/quote-entry/reviewCompletion.ts");
require("app/components/quote-entry/review-completion.css");
/** C74. Historical export/selector retained for the existing Builder integration.
 * Both buttons sequence the SAME margin save + draft confirmation. Only their
 * destination differs. Nothing here generates, saves or sends customer lines.
 */
function ConfirmQuoteButton({ quoteId, workspaceSlug, quoteStatus, onBeforeSubmit, onPendingChange, onConfirmed, onReviewMargins }) {
    const router = (0, navigation_1.useRouter)();
    const headingId = (0, react_1.useId)();
    const noticeId = (0, react_1.useId)();
    const [state, setState] = (0, react_1.useState)({ kind: 'idle' });
    const pendingCallback = (0, react_1.useRef)(onPendingChange);
    pendingCallback.current = onPendingChange;
    const inFlight = (0, react_1.useRef)(false); // synchronous gate: also covers rapid mixed-button clicks
    const mounted = (0, react_1.useRef)(true);
    const confirmedHere = (0, react_1.useRef)(false);
    const resultRef = (0, react_1.useRef)(null);
    const primaryRef = (0, react_1.useRef)(null);
    const focusFrame = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            pendingCallback.current?.(false);
            if (focusFrame.current !== null)
                cancelAnimationFrame(focusFrame.current);
        };
    }, []);
    (0, react_1.useEffect)(() => {
        if (state.kind !== 'margin-warning' && state.kind !== 'confirmation-error' && state.kind !== 'navigation-error')
            return;
        const frame = requestAnimationFrame(() => {
            resultRef.current?.focus({ preventScroll: true });
            resultRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
        return () => cancelAnimationFrame(frame);
    }, [state]);
    function unlock() {
        inFlight.current = false;
        onPendingChange?.(false);
    }
    function openDestination(destination) {
        if (!mounted.current)
            return;
        inFlight.current = true;
        if (focusFrame.current !== null)
            cancelAnimationFrame(focusFrame.current);
        onPendingChange?.(true);
        setState({ kind: 'working', stage: 'opening', destination });
        try {
            // router.push is not a promise. Destination load/render failures are
            // handled by customer-edit/error.tsx, not a fictitious creation catch.
            router.push((0, reviewCompletion_1.reviewDestination)(workspaceSlug, quoteId, destination));
            // Stay locked until navigation unmounts this control. No polling/refresh.
        }
        catch {
            // Only synchronous navigation failures reach here. Preparation succeeded;
            // retrying this branch must NOT repeat the save or confirmation.
            setState({ kind: 'navigation-error', destination });
            inFlight.current = false; // Keep reviewed settings locked until an explicit return to editing.
        }
    }
    async function complete(destination) {
        if (inFlight.current)
            return;
        inFlight.current = true;
        if (focusFrame.current !== null)
            cancelAnimationFrame(focusFrame.current);
        onPendingChange?.(true);
        setState({ kind: 'working', stage: 'saving', destination });
        const needsConfirmation = quoteStatus === 'draft' && !confirmedHere.current;
        const outcome = await (0, reviewCompletion_1.prepareReviewCompletion)({
            saveMargins: onBeforeSubmit,
            confirmDraft: () => (0, actions_1.confirmQuote)(quoteId),
            needsConfirmation,
            shouldContinue: () => mounted.current,
            onStage: stage => { if (mounted.current)
                setState({ kind: 'working', stage, destination }); },
        });
        if (!mounted.current || outcome.status === 'abandoned')
            return;
        if (outcome.status === 'confirmation-failed') {
            setState({ kind: 'confirmation-error', destination, margins: outcome.margins });
            unlock();
            return;
        }
        if (needsConfirmation) {
            confirmedHere.current = true;
            onConfirmed?.();
        }
        if (outcome.margins.status === 'not-saved') {
            // Existing non-blocking contract retained, but no silent continuation.
            // The user may keep previously saved margins instead of fixing them now.
            setState({ kind: 'margin-warning', destination, message: outcome.margins.message });
            // Keep the review snapshot locked while the user chooses its next action.
            inFlight.current = false;
            return;
        }
        openDestination(destination);
    }
    function reviewMargins() {
        setState({ kind: 'idle' });
        unlock();
        focusFrame.current = requestAnimationFrame(() => {
            if (!mounted.current)
                return;
            if (onReviewMargins)
                onReviewMargins();
            else
                primaryRef.current?.focus();
        });
    }
    const working = state.kind === 'working';
    const normalActions = state.kind === 'idle' || working;
    const workingText = state.kind === 'working'
        ? state.stage === 'opening'
            ? state.destination === 'customer-quote' ? 'Opening customer quote…' : 'Opening Job Space…'
            : 'Saving pricing…'
        : '';
    return (0, jsx_runtime_1.jsxs)("section", { "data-qc-ui": "v2", "data-qc-component": "C74", "data-completion-state": state.kind, className: "qrc-completion qc-surface", "aria-labelledby": headingId, children: [(0, jsx_runtime_1.jsxs)("div", { className: "qrc-intro", children: [(0, jsx_runtime_1.jsx)("p", { className: "qrc-eyebrow", children: "Next step" }), (0, jsx_runtime_1.jsx)("h3", { id: headingId, children: "Ready to prepare the customer quote?" }), (0, jsx_runtime_1.jsx)("p", { children: "Save this pricing, then open the document your customer will see. Or return to Job Space to continue later." }), (0, jsx_runtime_1.jsx)("p", { className: "qrc-reassurance", children: "Neither option sends anything to your customer." })] }), normalActions && (0, jsx_runtime_1.jsxs)("div", { className: "qrc-actions", "aria-label": "Finish pricing", children: [(0, jsx_runtime_1.jsxs)(QcButton_1.QcButton, { ref: primaryRef, size: "lg", variant: "primary", "data-copilot": "quote-confirm", disabled: working, pending: working && state.destination === 'customer-quote', onClick: () => void complete('customer-quote'), children: [working && state.destination === 'customer-quote' ? 'Preparing customer quote…' : 'Continue to customer quote', (0, jsx_runtime_1.jsx)("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 12h14m-6-6 6 6-6 6" }) })] }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { size: "lg", variant: "ghost", "data-copilot": "quote-save-job-space", disabled: working, pending: working && state.destination === 'job-space', onClick: () => void complete('job-space'), children: working && state.destination === 'job-space' ? 'Saving for Job Space…' : 'Save & go to Job Space' })] }), (0, jsx_runtime_1.jsx)("p", { className: "qrc-progress", role: "status", "aria-live": "polite", "aria-atomic": "true", children: workingText }), state.kind === 'margin-warning' && (0, jsx_runtime_1.jsx)("div", { className: "qrc-result", ref: resultRef, tabIndex: -1, role: "region", "aria-labelledby": noticeId, children: (0, jsx_runtime_1.jsxs)(QcSurface_1.QcNotice, { tone: "warning", children: [(0, jsx_runtime_1.jsx)("h4", { id: noticeId, children: "Your margin changes were not saved" }), (0, jsx_runtime_1.jsxs)("p", { children: [state.message, " The last saved margins will be used. You can check them here or adjust them in the customer quote editor."] }), (0, jsx_runtime_1.jsx)("p", { children: "Your quote is available. Continuing does not send it." }), (0, jsx_runtime_1.jsxs)("div", { className: "qrc-result-actions", children: [(0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { variant: "primary", onClick: reviewMargins, children: "Review margins" }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { variant: "ghost", onClick: () => { if (!inFlight.current)
                                        openDestination(state.destination); }, children: state.destination === 'customer-quote' ? 'Continue with saved margins' : 'Go to Job Space with saved margins' })] })] }) }), state.kind === 'confirmation-error' && (0, jsx_runtime_1.jsx)("div", { className: "qrc-result", ref: resultRef, tabIndex: -1, role: "region", "aria-labelledby": noticeId, children: (0, jsx_runtime_1.jsxs)(QcSurface_1.QcNotice, { tone: "danger", children: [(0, jsx_runtime_1.jsx)("h4", { id: noticeId, children: "We could not confirm the quote" }), (0, jsx_runtime_1.jsxs)("p", { children: [state.margins.status === 'saved' ? 'Your margin settings were saved, but quote confirmation could not be verified.' : 'Quote confirmation could not be verified. Check your margin settings before continuing.', " Your current review is still here. Nothing has been sent."] }), (0, jsx_runtime_1.jsxs)("div", { className: "qrc-result-actions", children: [(0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { variant: "primary", onClick: () => void complete(state.destination), children: "Try again" }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { variant: "ghost", onClick: reviewMargins, children: "Review pricing" })] })] }) }), state.kind === 'navigation-error' && (0, jsx_runtime_1.jsx)("div", { className: "qrc-result", ref: resultRef, tabIndex: -1, role: "region", "aria-labelledby": noticeId, children: (0, jsx_runtime_1.jsxs)(QcSurface_1.QcNotice, { tone: "warning", children: [(0, jsx_runtime_1.jsx)("h4", { id: noticeId, children: "Your quote is ready, but the next page could not open" }), (0, jsx_runtime_1.jsx)("p", { children: "Try opening it again or go to Job Space. This will not replace your saved customer document." }), (0, jsx_runtime_1.jsxs)("div", { className: "qrc-result-actions", children: [(0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { variant: "primary", onClick: () => { if (!inFlight.current)
                                        openDestination(state.destination); }, children: "Try opening again" }), (0, jsx_runtime_1.jsx)("a", { className: "qc-button", "data-qc-variant": "ghost", href: (0, reviewCompletion_1.reviewDestination)(workspaceSlug, quoteId, 'job-space'), children: "Go to Job Space" }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { variant: "ghost", onClick: reviewMargins, children: "Review pricing" })] })] }) })] });
}

},"next/navigation":function(require,module,exports){
exports.useRouter=()=>window.fx.router;exports.useParams=()=>({workspaceSlug:'demo',id:'quote-fixture'});exports.useSearchParams=()=>new URLSearchParams(location.search);
},"app/components/ui/v2/QcButton.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcLinkButton = exports.QcButton = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
require("app/components/ui/v2/qc.css");
/** C01. Native button/ref/form semantics; no request, pricing or permission logic. */
exports.QcButton = (0, react_1.forwardRef)(function QcButton({ variant = 'ghost', size = 'md', pending = false, disabled, type = 'button', className = '', children, ...props }, ref) {
    return ((0, jsx_runtime_1.jsx)("button", { ...props, ref: ref, type: type, disabled: disabled || pending, "aria-busy": pending || props['aria-busy'] || undefined, "data-qc-component": "C01", "data-qc-variant": variant, "data-qc-size": size, className: `qc-button ${className}`, children: children }));
});
/** C02. For native links. Next Link can use the same class/data recipe directly. */
exports.QcLinkButton = (0, react_1.forwardRef)(function QcLinkButton({ variant = 'ghost', size = 'md', className = '', ...props }, ref) {
    return (0, jsx_runtime_1.jsx)("a", { ...props, ref: ref, "data-qc-component": "C02", "data-qc-variant": variant, "data-qc-size": size, className: `qc-button ${className}` });
});

},"app/components/ui/v2/qc.css":function(require,module,exports){

},"app/components/ui/v2/QcSurface.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcSurface = QcSurface;
exports.QcNotice = QcNotice;
exports.QcStatusBadge = QcStatusBadge;
const jsx_runtime_1 = require("react/jsx-runtime");
require("app/components/ui/v2/qc.css");
/** C18. Solid data surface. Glass is reserved for floating controls. */
function QcSurface({ className = '', ...props }) {
    return (0, jsx_runtime_1.jsx)("div", { ...props, "data-qc-component": "C18", className: `qc-surface ${className}` });
}
/** C30. Copy and the decision to announce it belong to the feature. */
function QcNotice({ children, tone = 'neutral', className = '', ...props }) {
    return (0, jsx_runtime_1.jsxs)("div", { ...props, "data-qc-component": "C30", "data-qc-tone": tone, className: `qc-notice ${className}`, children: [(0, jsx_runtime_1.jsxs)("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", children: [(0, jsx_runtime_1.jsx)("circle", { cx: "12", cy: "12", r: "9" }), (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", d: "M12 11v6m0-10v.1" })] }), (0, jsx_runtime_1.jsx)("div", { children: children })] });
}
/** C13. Display only. The caller supplies the existing status, never a transition. */
function QcStatusBadge({ children, tone = 'neutral' }) {
    return (0, jsx_runtime_1.jsx)("span", { "data-qc-component": "C13", "data-qc-tone": tone, className: "qc-status", children: children });
}

},"app/components/quote-entry/reviewCompletion.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewDestination = reviewDestination;
exports.prepareReviewCompletion = prepareReviewCompletion;
function reviewDestination(workspaceSlug, quoteId, destination) {
    const base = `/${encodeURIComponent(workspaceSlug)}/quotes/${encodeURIComponent(quoteId)}`;
    return `${base}/${destination === 'customer-quote' ? 'customer-edit' : 'summary'}`;
}
/** Drafts use the existing idempotent confirmQuote action. Non-drafts retain the
 * old saveConfirmedQuoteAndRedirect semantics: no additional status mutation.
 * shouldContinue only cancels CLIENT continuation after unmount, not server work.
 */
async function prepareReviewCompletion({ saveMargins, confirmDraft, needsConfirmation, onStage, shouldContinue }) {
    const active = () => shouldContinue?.() !== false;
    if (!active())
        return { status: 'abandoned' };
    onStage?.('saving');
    let margins = { status: 'unchanged' };
    try {
        margins = (await saveMargins?.()) ?? { status: 'unchanged' };
    }
    catch {
        margins = { status: 'not-saved', message: 'The margin changes could not be saved.' };
    }
    if (!active())
        return { status: 'abandoned' };
    if (needsConfirmation) {
        onStage?.('confirming');
        try {
            await confirmDraft();
        }
        catch {
            return active() ? { status: 'confirmation-failed', margins } : { status: 'abandoned' };
        }
    }
    return active() ? { status: 'ready', margins } : { status: 'abandoned' };
}

},"app/components/quote-entry/review-completion.css":function(require,module,exports){

},"app/(auth)/[workspaceSlug]/quotes/[id]/CurrencySelector.tsx":function(require,module,exports){
exports.CurrencySelector=()=>require('react').createElement('span',{className:'qc-status'},'GBP');
},"app/(auth)/[workspaceSlug]/quotes/[id]/FilesManager.tsx":function(require,module,exports){
exports.FilesManager=()=>null;
},"app/lib/currency/currencies.ts":function(require,module,exports){
"use strict";
// Currency definitions and formatting utilities
// ISO 4217 currency codes with display metadata
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENCY_GROUPS = exports.ALL_CURRENCY_CODES = exports.OTHER_CURRENCIES = exports.DOLLAR_CURRENCIES = exports.CURRENCIES = void 0;
exports.formatCurrency = formatCurrency;
exports.getCurrencySymbol = getCurrencySymbol;
exports.getCurrencyName = getCurrencyName;
exports.formatCurrencyWithCode = formatCurrencyWithCode;
exports.getEffectiveCurrency = getEffectiveCurrency;
// =============================================================================
// Currency Definitions
// =============================================================================
exports.CURRENCIES = {
    // Dollar variants (all use $ symbol)
    NZD: {
        code: 'NZD',
        symbol: '$',
        name: 'New Zealand Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    AUD: {
        code: 'AUD',
        symbol: '$',
        name: 'Australian Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    USD: {
        code: 'USD',
        symbol: '$',
        name: 'US Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    CAD: {
        code: 'CAD',
        symbol: '$',
        name: 'Canadian Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    SGD: {
        code: 'SGD',
        symbol: '$',
        name: 'Singapore Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    HKD: {
        code: 'HKD',
        symbol: '$',
        name: 'Hong Kong Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    // Major currencies (non-dollar)
    GBP: {
        code: 'GBP',
        symbol: '£',
        name: 'British Pound',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    EUR: {
        code: 'EUR',
        symbol: '€',
        name: 'Euro',
        symbolPosition: 'before',
        decimalSeparator: ',',
        thousandsSeparator: '.',
        decimals: 2,
    },
    JPY: {
        code: 'JPY',
        symbol: '¥',
        name: 'Japanese Yen',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 0, // Yen has no decimal subdivision
    },
    CNY: {
        code: 'CNY',
        symbol: '¥',
        name: 'Chinese Yuan',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    CHF: {
        code: 'CHF',
        symbol: 'CHF',
        name: 'Swiss Franc',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    INR: {
        code: 'INR',
        symbol: '₹',
        name: 'Indian Rupee',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
};
// =============================================================================
// Currency Lists for UI
// =============================================================================
exports.DOLLAR_CURRENCIES = ['NZD', 'AUD', 'USD', 'CAD', 'SGD', 'HKD'];
exports.OTHER_CURRENCIES = ['GBP', 'EUR', 'JPY', 'CNY', 'CHF', 'INR'];
exports.ALL_CURRENCY_CODES = [...exports.DOLLAR_CURRENCIES, ...exports.OTHER_CURRENCIES];
// Grouped for dropdown UI
exports.CURRENCY_GROUPS = [
    {
        label: 'Dollar Currencies',
        currencies: exports.DOLLAR_CURRENCIES.map(code => exports.CURRENCIES[code]),
    },
    {
        label: 'Other Currencies',
        currencies: exports.OTHER_CURRENCIES.map(code => exports.CURRENCIES[code]),
    },
];
// =============================================================================
// Formatting Functions
// =============================================================================
/**
 * Format a number as currency
 * @param amount - Raw number (e.g., 1234.56)
 * @param currencyCode - ISO 4217 code (e.g., 'NZD')
 * @returns Formatted string (e.g., '$1,234.56')
 */
function formatCurrency(amount, currencyCode) {
    const currency = exports.CURRENCIES[currencyCode];
    if (!currency) {
        // Fallback: use NZD formatting if currency not found
        console.warn(`Unknown currency code: ${currencyCode}, falling back to NZD`);
        return formatCurrency(amount, 'NZD');
    }
    // Round to correct decimal places
    const rounded = Math.round(amount * Math.pow(10, currency.decimals)) / Math.pow(10, currency.decimals);
    // Format integer and decimal parts
    const [integerPart, decimalPart] = rounded.toFixed(currency.decimals).split('.');
    // Add thousands separators
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousandsSeparator);
    // Combine with decimal separator
    let formattedNumber = formattedInteger;
    if (currency.decimals > 0) {
        formattedNumber += currency.decimalSeparator + decimalPart;
    }
    // Add currency symbol
    if (currency.symbolPosition === 'before') {
        return `${currency.symbol}${formattedNumber}`;
    }
    else {
        return `${formattedNumber}${currency.symbol}`;
    }
}
/**
 * Get currency symbol only
 */
function getCurrencySymbol(currencyCode) {
    return exports.CURRENCIES[currencyCode]?.symbol || '$';
}
/**
 * Get currency name
 */
function getCurrencyName(currencyCode) {
    return exports.CURRENCIES[currencyCode]?.name || currencyCode;
}
/**
 * Format currency with code suffix (for disambiguation)
 * @example formatCurrencyWithCode(1234.56, 'NZD') => '$1,234.56 NZD'
 */
function formatCurrencyWithCode(amount, currencyCode) {
    return `${formatCurrency(amount, currencyCode)} ${currencyCode}`;
}
// =============================================================================
// Helper: Get effective currency (with company fallback)
// =============================================================================
/**
 * Resolve effective currency (quote.currency || company.default_currency)
 * @param quoteCurrency - Quote's currency (can be null)
 * @param companyDefaultCurrency - Company's default currency
 * @returns Effective currency code to use
 */
function getEffectiveCurrency(quoteCurrency, companyDefaultCurrency) {
    return quoteCurrency || companyDefaultCurrency;
}

},"app/components/ConfirmModal.tsx":function(require,module,exports){
exports.ConfirmModal=()=>null;
},"app/components/CreateSmartComponentModal.tsx":function(require,module,exports){
exports.CreateSmartComponentModal=()=>null;
},"app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/RoofAreaCard.tsx":function(require,module,exports){
exports.RoofAreaCard=()=>null;
},"app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx":function(require,module,exports){
exports.ExpandableComponent=()=>null;
},"app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/AddFromLibrary.tsx":function(require,module,exports){
exports.AddFromLibrary=()=>null;
},"app/components/ui/ScrollIndicator.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScrollIndicator = ScrollIndicator;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
/**
 * Horizontal scroll container with a persistent orange indicator bar.
 *
 * Native -webkit-scrollbar styling doesn't reliably show on iOS Safari,
 * so we render a custom indicator bar below the scrollable content.
 *
 * The bar is always visible: faint orange at idle, brighter when scrolling.
 */
function ScrollIndicator({ children, className = '', ariaLabel }) {
    const scrollRef = (0, react_1.useRef)(null);
    const [ratio, setRatio] = (0, react_1.useState)(0);
    const [thumbWidth, setThumbWidth] = (0, react_1.useState)(30);
    const [isScrolling, setIsScrolling] = (0, react_1.useState)(false);
    const scrollTimeout = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        const update = () => {
            const { scrollLeft, scrollWidth, clientWidth } = el;
            const maxScroll = scrollWidth - clientWidth;
            if (maxScroll <= 0) {
                setRatio(0);
                return;
            }
            setRatio(scrollLeft / maxScroll);
            // Thumb width proportional to visible vs total content
            const visibleRatio = clientWidth / scrollWidth;
            const thumbPct = Math.max(visibleRatio * 100, 15); // min 15% so it's always visible
            setThumbWidth(thumbPct);
        };
        const handleScroll = () => {
            update();
            setIsScrolling(true);
            if (scrollTimeout.current)
                clearTimeout(scrollTimeout.current);
            scrollTimeout.current = setTimeout(() => setIsScrolling(false), 800);
        };
        update();
        el.addEventListener('scroll', handleScroll, { passive: true });
        // Re-measure on resize
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', handleScroll);
            ro.disconnect();
            if (scrollTimeout.current)
                clearTimeout(scrollTimeout.current);
        };
    }, []);
    const showBar = ratio > 0 || thumbWidth < 100;
    return ((0, jsx_runtime_1.jsxs)("div", { className: className, children: [(0, jsx_runtime_1.jsx)("div", { ref: scrollRef, role: ariaLabel ? 'region' : undefined, "aria-label": ariaLabel, tabIndex: ariaLabel ? 0 : undefined, className: "overflow-x-auto scrollbar-hide", style: { WebkitOverflowScrolling: 'touch' }, children: children }), showBar && ((0, jsx_runtime_1.jsx)("div", { className: "relative h-1.5 mt-0.5 mx-4 md:mx-0 rounded-full bg-slate-100/60", children: (0, jsx_runtime_1.jsx)("div", { className: "absolute h-full rounded-full transition-all duration-150", style: {
                        width: `${thumbWidth}%`,
                        left: `${ratio * (100 - thumbWidth)}%`,
                        backgroundColor: isScrolling
                            ? 'rgba(255, 107, 53, 0.8)'
                            : 'rgba(255, 107, 53, 0.35)',
                    } }) }))] }));
}

},"app/components/ui/v2/QcField.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcSelect = exports.QcInput = void 0;
exports.QcField = QcField;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
require("app/components/ui/v2/qc.css");
/** C05. Pass numeric strings, units, events and validation through unchanged. */
exports.QcInput = (0, react_1.forwardRef)(function QcInput({ className = '', ...props }, ref) {
    return (0, jsx_runtime_1.jsx)("input", { ...props, ref: ref, "data-qc-component": "C05", className: `qc-input ${className}` });
});
/** C06. Keep native keyboard selection and the caller's complete option set. */
exports.QcSelect = (0, react_1.forwardRef)(function QcSelect({ className = '', ...props }, ref) {
    return (0, jsx_runtime_1.jsx)("select", { ...props, ref: ref, "data-qc-component": "C06", className: `qc-select ${className}` });
});
/** C04. Callers connect help/error ids to their control with aria-describedby. */
function QcField({ label, htmlFor, children, help, helpId, className = '' }) {
    return (0, jsx_runtime_1.jsxs)("div", { "data-qc-component": "C04", className: `qc-field ${className}`, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: htmlFor, className: "qc-label", children: label }), children, help && (0, jsx_runtime_1.jsx)("p", { id: helpId, className: "qc-help", children: help })] });
}

},"app/components/ui/v2/QcWorkflowStepper.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcWorkflowStepper = QcWorkflowStepper;
const jsx_runtime_1 = require("react/jsx-runtime");
require("app/components/ui/v2/qc.css");
/** C34. Ordinals are navigation, not an inferred completion/progress score. */
function QcWorkflowStepper({ steps, current, onSelect }) {
    return ((0, jsx_runtime_1.jsx)("nav", { "aria-label": "Quote builder steps", "data-qc-component": "C34", className: "qc-stepper", children: (0, jsx_runtime_1.jsx)("ol", { children: steps.map((step, index) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => onSelect(step.key), disabled: step.disabled, "aria-current": current === step.key ? 'step' : undefined, children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-step-number", "aria-hidden": "true", children: index + 1 }), (0, jsx_runtime_1.jsxs)("span", { className: "qc-step-copy", children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-step-label", children: step.label }), step.description && (0, jsx_runtime_1.jsx)("span", { className: "qc-step-description", children: step.description })] })] }) }, step.key))) }) }));
}

},"app/components/ui/v2/QcMoneySummary.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcMoneySummary = QcMoneySummary;
const jsx_runtime_1 = require("react/jsx-runtime");
require("app/components/ui/v2/qc.css");
/** C35. Accept already-formatted values only. Never calculate or convert here. */
function QcMoneySummary({ audience, title, rows, totalLabel, total, note }) {
    return ((0, jsx_runtime_1.jsxs)("section", { "data-qc-component": "C35", "data-qc-audience": audience, className: "qc-money-summary", "aria-label": title, children: [(0, jsx_runtime_1.jsx)("h2", { children: title }), (0, jsx_runtime_1.jsx)("dl", { className: "qc-money-rows", children: rows.map(row => (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("dt", { children: row.label }), (0, jsx_runtime_1.jsx)("dd", { children: row.value })] }, row.id)) }), (0, jsx_runtime_1.jsx)("dl", { className: "qc-money-total", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("dt", { children: totalLabel }), (0, jsx_runtime_1.jsx)("dd", { children: total })] }) }), note && (0, jsx_runtime_1.jsx)("p", { className: "qc-help", children: note })] }));
}

},"app/components/ui/v2/useQcFeedback.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useQcFeedback = useQcFeedback;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const AlertModal_1 = require("app/components/AlertModal.tsx");
const ConfirmModal_1 = require("app/components/ConfirmModal.tsx");
/** Awaitable feedback preserves the pause formerly provided by native dialogs.
 * Only UI acknowledgements live here; no mutation, validation or pricing is added.
 */
function useQcFeedback() {
    const queue = (0, react_1.useRef)([]);
    const [request, setRequest] = (0, react_1.useState)(null);
    const enqueue = (0, react_1.useCallback)((kind, options) => new Promise(resolve => {
        const next = { ...options, kind, resolve };
        queue.current.push(next);
        if (queue.current.length === 1)
            setRequest(next);
    }), []);
    const notify = (0, react_1.useCallback)(async (description, title = 'Please check this action') => {
        await enqueue('alert', { title, description, confirmLabel: 'OK' });
    }, [enqueue]);
    const ask = (0, react_1.useCallback)((options) => enqueue('confirm', options), [enqueue]);
    const settle = (0, react_1.useCallback)((accepted) => {
        const current = queue.current.shift();
        setRequest(queue.current[0] ?? null);
        current?.resolve(accepted);
    }, []);
    (0, react_1.useEffect)(() => () => {
        // Do not leave waiting UI tasks behind after the owning page unmounts.
        queue.current.splice(0).forEach(item => item.resolve(false));
    }, []);
    const feedback = request?.kind === 'confirm' ? ((0, jsx_runtime_1.jsx)(ConfirmModal_1.ConfirmModal, { appearance: "v2", open: true, title: request.title, description: request.description, confirmLabel: request.confirmLabel ?? 'Continue', cancelLabel: request.cancelLabel ?? 'Cancel', destructive: request.destructive ?? false, onCancel: () => settle(false), onConfirm: () => settle(true) })) : ((0, jsx_runtime_1.jsx)(AlertModal_1.AlertModal, { appearance: "v2", open: request !== null, title: request?.title ?? '', description: request?.description, confirmLabel: request?.confirmLabel, onClose: () => settle(true) }));
    return { notify, ask, feedback, feedbackOpen: request !== null };
}

},"app/components/AlertModal.tsx":function(require,module,exports){
exports.AlertModal=()=>null;
},"app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/quote-builder.css":function(require,module,exports){

},"app/components/quote-entry/CustomerQuoteRouteState.tsx":function(require,module,exports){
"use client";
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerQuoteRouteState = CustomerQuoteRouteState;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const link_1 = __importDefault(require("next/link"));
const QcButton_1 = require("app/components/ui/v2/QcButton.tsx");
const reviewCompletion_1 = require("app/components/quote-entry/reviewCompletion.ts");
require("app/components/quote-entry/review-completion.css");
/** Recovery belongs to the document route, including direct visits/bookmarks.
 * Never infer "saved" from a query flag. No re-creation or save on retry.
 * Retry must re-fetch server data, not merely clear a client error boundary.
 * Older runtimes without a re-fetch callback get an ordinary same-route link.
 */
function CustomerQuoteRouteState({ failed = false, retry }) {
    const { workspaceSlug, id } = (0, navigation_1.useParams)();
    const [retrying, startTransition] = (0, react_1.useTransition)();
    const jobHref = typeof workspaceSlug === 'string' && typeof id === 'string'
        ? (0, reviewCompletion_1.reviewDestination)(workspaceSlug, id, 'job-space') : null;
    const documentHref = typeof workspaceSlug === 'string' && typeof id === 'string'
        ? (0, reviewCompletion_1.reviewDestination)(workspaceSlug, id, 'customer-quote') : null;
    return (0, jsx_runtime_1.jsxs)("section", { "data-qc-ui": "v2", className: "qrc-route-state qc-surface", "aria-labelledby": "customer-quote-route-title", children: [(0, jsx_runtime_1.jsx)("p", { className: "qrc-eyebrow", children: "Customer quote" }), (0, jsx_runtime_1.jsx)("h1", { id: "customer-quote-route-title", className: "qrc-route-heading", children: failed ? 'The customer quote could not be opened' : 'Opening your customer quote…' }), (0, jsx_runtime_1.jsx)("p", { className: "qrc-route-copy", role: failed ? 'alert' : 'status', children: failed
                    ? 'Try loading it again, or return to Job Space. Retrying does not regenerate or replace any saved customer-quote lines. If you had unsaved edits, check the last saved document before continuing.'
                    : 'Loading your saved document, or preparing initial lines from the priced components. Nothing is sent by opening this page.' }), (0, jsx_runtime_1.jsxs)("div", { className: "qrc-result-actions", children: [failed && (retry ? (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { variant: "primary", pending: retrying, onClick: () => startTransition(retry), children: retrying ? 'Trying again…' : 'Try again' }) : documentHref && (0, jsx_runtime_1.jsx)("a", { href: documentHref, className: "qc-button", "data-qc-variant": "primary", children: "Try again" })), jobHref && (0, jsx_runtime_1.jsx)(link_1.default, { prefetch: false, href: jobHref, className: "qc-button", "data-qc-variant": "ghost", children: "Go to Job Space" })] })] });
}

},"app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/error.tsx":function(require,module,exports){
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CustomerQuoteError;
const jsx_runtime_1 = require("react/jsx-runtime");
const CustomerQuoteRouteState_1 = require("app/components/quote-entry/CustomerQuoteRouteState.tsx");
/** Load/render failure only. Existing editor save/send contracts stay intact.
 * The pinned Next 16.2 exposes unstable_retry to re-fetch server content. reset
 * alone only re-renders cached contents. The plain-link fallback in RouteState
 * works without version-specific APIs. Neither path saves or recreates lines.
 */
function CustomerQuoteError({ unstable_retry }) {
    return (0, jsx_runtime_1.jsx)(CustomerQuoteRouteState_1.CustomerQuoteRouteState, { failed: true, retry: unstable_retry });
}

},"app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/loading.tsx":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CustomerQuoteLoading;
const jsx_runtime_1 = require("react/jsx-runtime");
const CustomerQuoteRouteState_1 = require("app/components/quote-entry/CustomerQuoteRouteState.tsx");
function CustomerQuoteLoading() {
    return (0, jsx_runtime_1.jsx)(CustomerQuoteRouteState_1.CustomerQuoteRouteState, {});
}

}};const cache={};function require(id){if(id==='react')return window.React;if(id==='react-dom')return window.ReactDOM;if(id==='react/jsx-runtime')return {Fragment:React.Fragment,jsx:(t,p,k)=>React.createElement(t,k===undefined?p:{...p,key:k}),jsxs:(t,p,k)=>React.createElement(t,k===undefined?p:{...p,key:k})};if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;if(!modules[id])throw Error('Unknown module '+id);modules[id](require,m,m.exports);return m.exports;}window.sourceRequire=require;