INSERT INTO public.free_tool_roof_components (
  tenant_id, component_kind, name, description, unit, price_per_unit,
  pricing_strategy, labour_rate, labour_unit, suggested_waste_percent,
  pitch_type, is_active, sort_order
)
SELECT NULL, 'underlay', 'Underlay', 'Roofing underlay or membrane', 'm2', 0,
  'per_unit', 0, 'per_unit', 10, 'rafter', true, 7
WHERE NOT EXISTS (
  SELECT 1 FROM public.free_tool_roof_components
  WHERE tenant_id IS NULL AND component_kind = 'underlay'
);

INSERT INTO public.free_tool_roof_components (
  tenant_id, component_kind, name, description, unit, price_per_unit,
  pricing_strategy, labour_rate, labour_unit, suggested_waste_percent,
  pitch_type, is_active, sort_order
)
SELECT NULL, 'fixings', 'Fixings', 'Nails, screws, and clips', 'm2', 0,
  'per_unit', 0, 'per_unit', 5, 'rafter', true, 8
WHERE NOT EXISTS (
  SELECT 1 FROM public.free_tool_roof_components
  WHERE tenant_id IS NULL AND component_kind = 'fixings'
);
