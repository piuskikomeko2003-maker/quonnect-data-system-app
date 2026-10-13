-- Migration: Sticker sheet auto-centring + corrected built-in defaults
--
-- Adds `auto_center` so the grid can be centred on the page automatically
-- (left = (page − columns×width − gaps) ÷ 2, top = (page − rows×height − gaps) ÷ 2)
-- while still allowing a manual top/left margin override.
--
-- It also corrects the two built-in presets to the current defaults:
--   3 columns × 10 rows, 64 × 23 mm stickers, no gaps => exactly 30 per A4 page.
-- `cut_lines` is set correctly per preset (OFF for the pre-cut sheet, ON for
-- plain paper). Existing *custom* templates (any other preset_key) are untouched.
--
-- Safe to run more than once. Idempotent.

-- ---------------------------------------------------------------------------
-- 1. auto_center column
-- ---------------------------------------------------------------------------
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS auto_center BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 2. Corrected grid geometry for the two built-in presets
-- ---------------------------------------------------------------------------
UPDATE public.sticker_templates
   SET page_width_mm    = 210,
       page_height_mm   = 297,
       columns          = 3,
       rows             = 10,
       sticker_width_mm = 64,
       sticker_height_mm = 23,
       gap_x_mm         = 0,
       gap_y_mm         = 0,
       inner_padding_mm = 2,
       auto_center      = true,
       margin_left_mm   = 9,     -- (210 - 3*64) / 2
       margin_top_mm    = 33.5,  -- (297 - 10*23) / 2
       cut_lines        = (preset_key = 'plain_paper'),
       design           = '{
         "business_name": {"enabled": true, "x": 6, "y": 8,  "width": 88, "height": 40, "fontFamily": "helvetica", "fontSizePct": 30, "bold": true,  "color": "#111827", "align": "left",   "vAlign": "top",    "autoShrink": true,  "wrap2": true},
         "ticket_number": {"enabled": true, "x": 6, "y": 50, "width": 88, "height": 18, "fontFamily": "helvetica", "fontSizePct": 14, "bold": false, "color": "#111827", "align": "left",   "vAlign": "middle", "autoShrink": false, "wrap2": false},
         "table_label":   {"enabled": true, "x": 6, "y": 72, "width": 88, "height": 22, "fontFamily": "helvetica", "fontSizePct": 17, "bold": true,  "color": "#0d0d0f", "align": "center", "vAlign": "bottom", "autoShrink": false, "wrap2": false}
       }'::jsonb
 WHERE preset_key IN ('precut_label', 'plain_paper');

-- ---------------------------------------------------------------------------
-- 3. Keep the column default in step for future rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.sticker_templates
  ALTER COLUMN design SET DEFAULT '{
     "business_name": {"enabled": true, "x": 6, "y": 8,  "width": 88, "height": 40, "fontFamily": "helvetica", "fontSizePct": 30, "bold": true,  "color": "#111827", "align": "left",   "vAlign": "top",    "autoShrink": true,  "wrap2": true},
     "ticket_number": {"enabled": true, "x": 6, "y": 50, "width": 88, "height": 18, "fontFamily": "helvetica", "fontSizePct": 14, "bold": false, "color": "#111827", "align": "left",   "vAlign": "middle", "autoShrink": false, "wrap2": false},
     "table_label":   {"enabled": true, "x": 6, "y": 72, "width": 88, "height": 22, "fontFamily": "helvetica", "fontSizePct": 17, "bold": true,  "color": "#0d0d0f", "align": "center", "vAlign": "bottom", "autoShrink": false, "wrap2": false}
   }'::jsonb;

NOTIFY pgrst, 'reload schema';
