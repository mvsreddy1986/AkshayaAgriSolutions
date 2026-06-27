-- Allow internal vouchers (Expense / Drawing) that have no supplier or customer party.
-- Drop NOT NULL from vouchers.party_id so NULL can be stored when party is not applicable.
-- The FK constraint (vouchers_party_id_fkey) is preserved — it only fires for non-NULL values.

ALTER TABLE vouchers
  ALTER COLUMN party_id DROP NOT NULL,
  ALTER COLUMN party_id SET DEFAULT NULL;

ALTER TABLE vouchers
  ALTER COLUMN party_name DROP NOT NULL,
  ALTER COLUMN party_name SET DEFAULT '';
