import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const editionId = formData.get('edition_id') as string || 'general';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanFileName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .slice(0, 50);
    const filePath = `receipts/${editionId}/${Date.now()}_${cleanFileName}`;

    // Ensure bucket exists
    const { error: uploadError } = await supabase.storage
      .from('finance_receipts')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      // If bucket doesn't exist yet, attempt to create it or return error
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        await supabase.storage.createBucket('finance_receipts', { public: true });
        const { error: retryErr } = await supabase.storage
          .from('finance_receipts')
          .upload(filePath, buffer, {
            contentType: file.type || 'image/jpeg',
            upsert: true,
          });
        if (retryErr) throw retryErr;
      } else {
        throw uploadError;
      }
    }

    const { data: publicUrlData } = supabase.storage
      .from('finance_receipts')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      fileName: file.name,
    });
  } catch (err: any) {
    console.error('Receipt upload error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to upload receipt file' },
      { status: 500 }
    );
  }
}
