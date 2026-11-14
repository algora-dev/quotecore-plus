-- QuoteCore+ Pricing Setup / five editable roofing starter libraries.
-- Additive migration, following 20261114160000_pricing_setup_assistant.sql.
-- Edit template content in Supabase Table Editor. On-conflict seeding does not overwrite existing edits.
-- Templates have NO assumed supplier, labour or waste rates; only verified user-approved drafts reach component_library.
CREATE TABLE IF NOT EXISTS public.pricing_starter_libraries (
 slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{3,64}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
 description text NOT NULL DEFAULT '',
 system text NOT NULL DEFAULT 'roofing',
 version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
 published boolean NOT NULL DEFAULT true,
 sort_order integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_starter_libraries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_starter_libraries_public_catalog ON public.pricing_starter_libraries;
CREATE POLICY pricing_starter_libraries_public_catalog ON public.pricing_starter_libraries
 FOR SELECT TO authenticated USING (published = true);

CREATE TABLE IF NOT EXISTS public.pricing_starter_items (
 library_slug text NOT NULL REFERENCES public.pricing_starter_libraries(slug) ON DELETE CASCADE,
 code text NOT NULL CHECK (code ~ '^[A-Z0-9_]{4,96}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 2 AND 180),
 notes text NOT NULL DEFAULT '',
 measurement_type text NOT NULL CHECK (measurement_type IN ('area','lineal','quantity','fixed','quantity_by_spacing')),
 pitch_type text NOT NULL CHECK (pitch_type IN ('none','rafter','valley_hip')),
 takeoff_slot text NOT NULL DEFAULT 'custom',
 source_unit text NOT NULL DEFAULT '',
 sort_order integer NOT NULL DEFAULT 0,
 included_by_default boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(library_slug,code)
);
CREATE INDEX IF NOT EXISTS pricing_starter_items_sort_idx ON public.pricing_starter_items(library_slug,sort_order);
ALTER TABLE public.pricing_starter_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_starter_items_public_catalog ON public.pricing_starter_items;
CREATE POLICY pricing_starter_items_public_catalog ON public.pricing_starter_items
 FOR SELECT TO authenticated USING (EXISTS (
   SELECT 1 FROM public.pricing_starter_libraries l WHERE l.slug = library_slug AND l.published = true
 ));

-- Editable, region-specific illustrative price sets may be added later after research.
-- No numeric examples are seeded to avoid accidentally misrepresenting suppliers or regions.
CREATE TABLE IF NOT EXISTS public.pricing_starter_price_sets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
 currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
 source_description text NOT NULL DEFAULT '',
 researched_at date,
 published boolean NOT NULL DEFAULT false,
 illustrative_only boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_starter_price_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_starter_price_sets_public_catalog ON public.pricing_starter_price_sets;
CREATE POLICY pricing_starter_price_sets_public_catalog ON public.pricing_starter_price_sets
 FOR SELECT TO authenticated USING (published = true AND illustrative_only = true);

CREATE TABLE IF NOT EXISTS public.pricing_starter_price_values (
 price_set_id uuid NOT NULL REFERENCES public.pricing_starter_price_sets(id) ON DELETE CASCADE,
 library_slug text NOT NULL,
 item_code text NOT NULL,
 material_cost numeric(16,4) CHECK (material_cost IS NULL OR material_cost >= 0),
 labour_cost numeric(16,4) CHECK (labour_cost IS NULL OR labour_cost >= 0),
 evidence_url text,
 evidence_note text NOT NULL DEFAULT '',
 PRIMARY KEY(price_set_id,library_slug,item_code),
 FOREIGN KEY(library_slug,item_code) REFERENCES public.pricing_starter_items(library_slug,code) ON DELETE CASCADE
);
ALTER TABLE public.pricing_starter_price_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_starter_price_values_public_catalog ON public.pricing_starter_price_values;
CREATE POLICY pricing_starter_price_values_public_catalog ON public.pricing_starter_price_values
 FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.pricing_starter_price_sets ps
    WHERE ps.id = price_set_id AND ps.published = true AND ps.illustrative_only = true
 ));

-- On-demand destination mapping prevents repeated saves from creating duplicate collections.
CREATE TABLE IF NOT EXISTS public.pricing_setup_starter_destinations (
 session_id uuid NOT NULL REFERENCES public.pricing_setup_sessions(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 library_slug text NOT NULL REFERENCES public.pricing_starter_libraries(slug),
 collection_id uuid NOT NULL REFERENCES public.component_collections(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id, library_slug)
);
ALTER TABLE public.pricing_setup_starter_destinations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_setup_starter_destinations_own_read ON public.pricing_setup_starter_destinations;
CREATE POLICY pricing_setup_starter_destinations_own_read ON public.pricing_setup_starter_destinations
 FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Optional context is informational. It does not change source cost classification on its own.
ALTER TABLE public.pricing_setup_sessions ADD COLUMN IF NOT EXISTS context_types text[] NOT NULL DEFAULT '{}';

INSERT INTO public.pricing_starter_libraries(slug,name,description,system,version,sort_order) VALUES ('asphalt-shingles','Asphalt Shingle Roofing','Common sloped-roof asphalt shingles, starter strips and edge details.','roofing',1,1) ON CONFLICT(slug) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('asphalt-shingles','ASPHALT_SHINGLES_01','Roof underlayment','Surface underlayment. Check manufacturer coverage, lap and roof-area basis.','area','rafter','roof_area','m²',1) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('asphalt-shingles','ASPHALT_SHINGLES_02','Asphalt field shingles','Roof covering. Enter your supplier cost per actual m², or update pricing strategy for bundles.','area','rafter','roof_area','m²',2) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('asphalt-shingles','ASPHALT_SHINGLES_03','Eaves starter strip','Conventional horizontal eaves. Confirm whether starter is also used at the rake.','lineal','none','custom','m',3) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('asphalt-shingles','ASPHALT_SHINGLES_04','Rake starter strip','Sloping rake edge. Pitch only converts a plan-view measurement.','lineal','rafter','barge','m',4) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('asphalt-shingles','ASPHALT_SHINGLES_05','Ridge-cap shingles','Horizontal ridge. Coverage per package varies by product.','lineal','none','ridge','m',5) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('asphalt-shingles','ASPHALT_SHINGLES_06','Hip-cap shingles','Conventional diagonal hip; confirm roof geometry and measurement basis.','lineal','valley_hip','hip','m',6) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('asphalt-shingles','ASPHALT_SHINGLES_07','Valley protection / lining','Exact valley method depends on closed/open design and manufacturer instructions.','lineal','valley_hip','valley','m',7) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('asphalt-shingles','ASPHALT_SHINGLES_08','Drip-edge metal','Eaves edge as default. Use separate rafter rule for a rake-edge application.','lineal','none','custom','m',8) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('asphalt-shingles','ASPHALT_SHINGLES_09','Shingle roofing fasteners','Counted nails/fasteners. Calculate quantity from coverage and specification, not a second pitch multiplier.','quantity','none','fixings','each',9) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_libraries(slug,name,description,system,version,sort_order) VALUES ('long-run-metal','Long-Run / Corrugated Metal Roofing','Continuous profiled metal sheets with typical roof-edge flashing details.','roofing',1,2) ON CONFLICT(slug) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('long-run-metal','LONG_RUN_METAL_01','Roofing underlay / blanket','Surface underlay; verify laps and product specification.','area','rafter','roof_area','m²',1) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('long-run-metal','LONG_RUN_METAL_02','Long-run profiled metal sheets','Use actual roof surface coverage. Set effective cover width if buying by sheet/length.','area','rafter','roof_area','m²',2) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('long-run-metal','LONG_RUN_METAL_03','Metal ridge flashing','Conventional horizontal ridge.','lineal','none','ridge','m',3) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('long-run-metal','LONG_RUN_METAL_04','Metal hip flashing','Conventional diagonal hip; confirm geometry.','lineal','valley_hip','hip','m',4) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('long-run-metal','LONG_RUN_METAL_05','Metal valley flashing','Conventional diagonal valley; confirm geometry and custom bends.','lineal','valley_hip','valley','m',5) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('long-run-metal','LONG_RUN_METAL_06','Barge / rake flashing','Sloping gable/rake edge.','lineal','rafter','barge','m',6) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('long-run-metal','LONG_RUN_METAL_07','Apron / abutment flashing','Location and orientation determine whether a roof pitch correction applies. Review before use.','lineal','none','custom','m',7) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('long-run-metal','LONG_RUN_METAL_08','Profile roofing fasteners','Fixing density depends on wind zone, substrate and manufacturer schedule.','quantity','none','fixings','each',8) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('long-run-metal','LONG_RUN_METAL_09','Metal profile closure strips','Confirm whether used at horizontal ridge/eaves or a sloping cut.','lineal','none','custom','m',9) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_libraries(slug,name,description,system,version,sort_order) VALUES ('concrete-tile','Concrete Tile Roofing','Common interlocking concrete roof-tile system with battens, edges and fittings.','roofing',1,3) ON CONFLICT(slug) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('concrete-tile','CONCRETE_TILE_01','Tile roof underlay','Underlay coverage excludes manufacturer-specific lap and waste assumptions.','area','rafter','roof_area','m²',1) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('concrete-tile','CONCRETE_TILE_02','Concrete roof field tiles','Use the manufacturer tile coverage / m² and real supplier rate.','area','rafter','roof_area','m²',2) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('concrete-tile','CONCRETE_TILE_03','Tile roof battens','Quantity requires tile gauge, roof dimensions and batten runs; not automatically derived from area.','lineal','none','custom','m',3) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('concrete-tile','CONCRETE_TILE_04','Concrete ridge tiles','Conventional horizontal ridge. Verify pieces per metre.','lineal','none','ridge','m',4) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('concrete-tile','CONCRETE_TILE_05','Concrete hip tiles','Conventional diagonal hip. Verify pieces per metre and geometry.','lineal','valley_hip','hip','m',5) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('concrete-tile','CONCRETE_TILE_06','Tile roof valley tray','Drainage and fixing details vary by roof type.','lineal','valley_hip','valley','m',6) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('concrete-tile','CONCRETE_TILE_07','Tile verge / gable finish','Along sloping gable edge.','lineal','rafter','barge','m',7) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('concrete-tile','CONCRETE_TILE_08','Tile clips and fasteners','Manufacturer fixing schedule and wind zone determine usage.','quantity','none','fixings','each',8) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('concrete-tile','CONCRETE_TILE_09','Ridge / hip fixing system','Dry-fix or mortar detail needs selection; pitch rule must match horizontal ridge or diagonal hip.','lineal','none','custom','m',9) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_libraries(slug,name,description,system,version,sort_order) VALUES ('natural-slate','Natural Slate Roofing','Traditional natural slate with separate eaves, verge and fixing details.','roofing',1,4) ON CONFLICT(slug) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('natural-slate','NATURAL_SLATE_01','Slate roof underlay','Follow manufacturer and local installation requirements.','area','rafter','roof_area','m²',1) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('natural-slate','NATURAL_SLATE_02','Natural slate field covering','Lap, slate size and exposure change quantity per m².','area','rafter','roof_area','m²',2) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('natural-slate','NATURAL_SLATE_03','Slate roof battens','Batten gauge and exposure require design confirmation.','lineal','none','custom','m',3) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('natural-slate','NATURAL_SLATE_04','Slate eaves / starter courses','Conventional horizontal eaves, verify starter courses and under-eaves.','lineal','none','custom','m',4) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('natural-slate','NATURAL_SLATE_05','Slate ridge finish','Conventional horizontal ridge; ridge type can vary.','lineal','none','ridge','m',5) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('natural-slate','NATURAL_SLATE_06','Slate hip finish','Conventional diagonal hip if measured in plan.','lineal','valley_hip','hip','m',6) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('natural-slate','NATURAL_SLATE_07','Slate valley flashing','Common metal valley method; verify selected installation detail.','lineal','valley_hip','valley','m',7) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('natural-slate','NATURAL_SLATE_08','Slate verge / rake detail','Sloping gable/rake edge.','lineal','rafter','barge','m',8) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('natural-slate','NATURAL_SLATE_09','Slate nails / hooks','Count according to manufacturer schedule and slate fixing method.','quantity','none','fixings','each',9) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_libraries(slug,name,description,system,version,sort_order) VALUES ('low-slope-membrane','Low-Slope Membrane Roofing','A generic low-slope starting point; confirm TPO, PVC or EPDM system before quoting.','roofing',1,5) ON CONFLICT(slug) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('low-slope-membrane','LOW_SLOPE_MEMBRANE_01','Roof deck preparation','Scope and preparation rate vary greatly; choose a measurable rate if needed.','fixed','none','custom','each',1) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('low-slope-membrane','LOW_SLOPE_MEMBRANE_02','Roof insulation boards','Measure actual coverage; confirm thickness, layers and fixing scheme.','area','rafter','roof_area','m²',2) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('low-slope-membrane','LOW_SLOPE_MEMBRANE_03','Membrane cover board','Optional depending on approved system; confirm product compatibility.','area','rafter','roof_area','m²',3) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('low-slope-membrane','LOW_SLOPE_MEMBRANE_04','Single-ply roof membrane','Select TPO, PVC or EPDM and verify material, laps and manufacturer requirements.','area','rafter','roof_area','m²',4) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('low-slope-membrane','LOW_SLOPE_MEMBRANE_05','Membrane field seams','Length and method depend on membrane system: welded or bonded seams.','lineal','none','custom','m',5) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('low-slope-membrane','LOW_SLOPE_MEMBRANE_06','Perimeter termination bar','Vertical/horizontal edge detail; verify actual measured length.','lineal','none','custom','m',6) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('low-slope-membrane','LOW_SLOPE_MEMBRANE_07','Wall upstand flashing','Measure the upstand length and height basis separately as required.','lineal','none','custom','m',7) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('low-slope-membrane','LOW_SLOPE_MEMBRANE_08','Roof drain outlet detail','Count outlets; include compatible drain flashing and labour.','quantity','none','custom','each',8) ON CONFLICT(library_slug,code) DO NOTHING;

INSERT INTO public.pricing_starter_items(library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order) VALUES ('low-slope-membrane','LOW_SLOPE_MEMBRANE_09','Penetration flashings / boots','Count penetrations; details differ by membrane system.','quantity','none','custom','each',9) ON CONFLICT(library_slug,code) DO NOTHING;
