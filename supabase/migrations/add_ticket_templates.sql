-- Migration: Add ticket_templates table and storage bucket configuration
--
-- Purpose: Enable per-edition custom ticket templates with dynamic field positioning,
-- live visual preview, and fallback to default ticket styling.

-- 1. Create ticket_templates table
CREATE TABLE IF NOT EXISTS public.ticket_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id UUID REFERENCES public.market_days(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  background_image_url TEXT NOT NULL,
  canvas_width INTEGER NOT NULL DEFAULT 1920,
  canvas_height INTEGER NOT NULL DEFAULT 1080,
  field_positions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ticket_templates_edition UNIQUE (edition_id)
);

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_ticket_templates_edition_id ON public.ticket_templates(edition_id);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_is_default ON public.ticket_templates(is_default) WHERE is_default = true;

-- 3. Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_ticket_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_templates_updated_at ON public.ticket_templates;
CREATE TRIGGER trg_ticket_templates_updated_at
  BEFORE UPDATE ON public.ticket_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ticket_templates_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ticket_templates ENABLE ROW LEVEL SECURITY;

-- Allow public read access so vendors and collect forms can fetch templates
DROP POLICY IF EXISTS "Allow public read on ticket_templates" ON public.ticket_templates;
CREATE POLICY "Allow public read on ticket_templates"
  ON public.ticket_templates FOR SELECT
  USING (true);

-- Allow authenticated users to manage templates
DROP POLICY IF EXISTS "Allow authenticated manage on ticket_templates" ON public.ticket_templates;
CREATE POLICY "Allow authenticated manage on ticket_templates"
  ON public.ticket_templates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Configure Supabase Storage bucket: ticket-assets
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'ticket-assets',
      'ticket-assets',
      true,
      10485760, -- 10MB
      ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = true,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

    -- Public read policy for ticket-assets bucket
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access Ticket Assets'
    ) THEN
      CREATE POLICY "Public Access Ticket Assets"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'ticket-assets');
    END IF;

    -- Authenticated write policy for ticket-assets bucket
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated Upload Ticket Assets'
    ) THEN
      CREATE POLICY "Authenticated Upload Ticket Assets"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'ticket-assets');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated Update Ticket Assets'
    ) THEN
      CREATE POLICY "Authenticated Update Ticket Assets"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (bucket_id = 'ticket-assets');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated Delete Ticket Assets'
    ) THEN
      CREATE POLICY "Authenticated Delete Ticket Assets"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'ticket-assets');
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Storage schema policies may require superuser or differ across environments; ignore if already handled
    NULL;
END $$;
