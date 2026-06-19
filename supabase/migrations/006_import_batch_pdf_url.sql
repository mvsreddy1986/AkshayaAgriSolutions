-- Add source_pdf_url to import_batches for storing uploaded PDF in Supabase Storage
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS source_pdf_url TEXT DEFAULT NULL;
