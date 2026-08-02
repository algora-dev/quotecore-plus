-- Update free_tool_roof_components with realistic GBP pricing
-- These are indicative material prices for the free takeoff builder on .com
-- Prices are per unit (m or m2) in GBP, excluding labour (free tool shows material cost)

UPDATE public.free_tool_roof_components SET 
  price_per_unit = 12.50,
  description = 'Concrete interlocking roof tiles',
  suggested_waste_percent = 10
WHERE tenant_id IS NULL AND component_kind = 'roof_area' AND name = 'Roof Area (default)';

UPDATE public.free_tool_roof_components SET 
  price_per_unit = 8.50,
  description = 'Concrete ridge tiles',
  suggested_waste_percent = 5
WHERE tenant_id IS NULL AND component_kind = 'ridge' AND name = 'Ridge (default)';

UPDATE public.free_tool_roof_components SET 
  price_per_unit = 7.50,
  description = 'Concrete hip tiles',
  suggested_waste_percent = 5
WHERE tenant_id IS NULL AND component_kind = 'hip' AND name = 'Hip (default)';

UPDATE public.free_tool_roof_components SET 
  price_per_unit = 14.00,
  description = 'GRP valley trough system',
  suggested_waste_percent = 5
WHERE tenant_id IS NULL AND component_kind = 'valley' AND name = 'Valley (default)';

UPDATE public.free_tool_roof_components SET 
  price_per_unit = 6.50,
  description = 'Dry verge barge system',
  suggested_waste_percent = 5
WHERE tenant_id IS NULL AND component_kind = 'barge' AND name = 'Barge (default)';

UPDATE public.free_tool_roof_components SET 
  price_per_unit = 9.00,
  description = 'PVC guttering and downpipe system',
  suggested_waste_percent = 5
WHERE tenant_id IS NULL AND component_kind = 'spouting' AND name = 'Spouting (default)';

UPDATE public.free_tool_roof_components SET 
  price_per_unit = 4.50,
  description = 'Breathable roofing underlay membrane',
  suggested_waste_percent = 10
WHERE tenant_id IS NULL AND component_kind = 'underlay' AND name = 'Underlay';

UPDATE public.free_tool_roof_components SET 
  price_per_unit = 3.50,
  description = 'Nails, screws, and clips',
  suggested_waste_percent = 5
WHERE tenant_id IS NULL AND component_kind = 'fixings' AND name = 'Fixings';

-- Update the two general components too
UPDATE public.free_tool_roof_components SET 
  price_per_unit = 18.00,
  description = 'Wide hip roll former flashing'
WHERE tenant_id IS NULL AND component_kind = 'general' AND name = 'Wide Hips';

UPDATE public.free_tool_roof_components SET 
  price_per_unit = 15.00,
  description = 'Side apron flashing'
WHERE tenant_id IS NULL AND component_kind = 'general' AND name = 'Side apron';
