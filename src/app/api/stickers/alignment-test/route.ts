import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireSuperAdmin } from '@/lib/auth/requireAdmin';
import { getStickerTemplate } from '@/lib/stickers/server';
import { renderAlignmentTestPdf } from '@/lib/stickers/pdf';

export const runtime = 'nodejs';

/**
 * Super-admin only. Renders a one-page PDF with every sticker slot outlined and
 * numbered, so the layout can be checked against a real label sheet.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('template_id');

    const supabase = createServiceClient();
    const template = await getStickerTemplate(supabase, templateId);
    if (!template) {
      return NextResponse.json({ error: 'No sticker template found.' }, { status: 404 });
    }

    const bytes = await renderAlignmentTestPdf(template);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="sticker-alignment-test.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Failed to render alignment test PDF:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to render alignment test PDF' },
      { status: 500 }
    );
  }
}
