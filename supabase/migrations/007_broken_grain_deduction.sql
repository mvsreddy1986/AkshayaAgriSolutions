-- Migration 007: Change broken_grain_pct from reject-trigger to deduction on Maize
--
-- Material master: update settlementRole in the params array element where paramKey = 'broken_grain_pct'
UPDATE materials
SET params = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'paramKey' = 'broken_grain_pct'
        THEN elem || '{"settlementRole":"deduction"}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(params) AS elem
)
WHERE id = 'mat-001';

-- Quality rule qr-001 (May 2026 Maize, Active):
-- Add broken_grain_pct deduction entry if not already present
UPDATE quality_rules
SET param_rules = param_rules || '[{
  "paramKey": "broken_grain_pct",
  "label": "Broken Grain %",
  "baseValue": 5,
  "deductionMethod": "linear",
  "linearRate": 0.50
}]'::jsonb
WHERE id = 'qr-001'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(param_rules) AS r
    WHERE r->>'paramKey' = 'broken_grain_pct'
  );

-- Quality rule qr-002 (April 2026 Maize, Expired):
UPDATE quality_rules
SET param_rules = param_rules || '[{
  "paramKey": "broken_grain_pct",
  "label": "Broken Grain %",
  "baseValue": 5,
  "deductionMethod": "linear",
  "linearRate": 0.50
}]'::jsonb
WHERE id = 'qr-002'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(param_rules) AS r
    WHERE r->>'paramKey' = 'broken_grain_pct'
  );
