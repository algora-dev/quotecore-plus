-- Patch 006: Rename 'lineal' to 'linear' in measurement_type enum
-- Run after patch 005

ALTER TYPE measurement_type RENAME VALUE 'lineal' TO 'linear';
