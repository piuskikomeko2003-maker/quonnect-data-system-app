import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';

// GET /api/finance/incomes?edition_id=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('edition_id');

    if (!editionId) {
      return NextResponse.json({ error: 'edition_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('finance_incomes')
      .select('*')
      .eq('market_day_id', editionId)
      .order('date_received', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return NextResponse.json({ incomes: [], tableMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ incomes: data || [], tableMissing: false });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch incomes' },
      { status: 500 }
    );
  }
}

// POST /api/finance/incomes
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const {
      market_day_id,
      source_category_id,
      source_category_name,
      description,
      amount,
      date_received,
    } = body;

    if (!market_day_id) {
      return NextResponse.json({ error: 'market_day_id (edition) is required' }, { status: 400 });
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ error: 'Valid positive amount (UGX) is required' }, { status: 400 });
    }
    if (!source_category_name?.trim()) {
      return NextResponse.json({ error: 'Income source/category is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const payload = {
      market_day_id,
      source_category_id: source_category_id || null,
      source_category_name: source_category_name.trim(),
      description: description.trim(),
      amount: parsedAmount,
      date_received: date_received || new Date().toISOString().split('T')[0],
      created_by: auth.user?.id || null,
      created_by_email: auth.user?.email || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase
      .from('finance_incomes') as any)
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return NextResponse.json(
          {
            error:
              "Database table 'finance_incomes' does not exist yet. Please run 'add_finance_module.sql' in your Supabase SQL Editor.",
            tableMissing: true,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ income: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to create income entry' },
      { status: 500 }
    );
  }
}

// PATCH /api/finance/incomes
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { id, source_category_id, source_category_name, description, amount, date_received } = body;

    if (!id) {
      return NextResponse.json({ error: 'Income ID is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (description !== undefined) updates.description = description.trim();
    if (source_category_name !== undefined) updates.source_category_name = source_category_name.trim();
    if (source_category_id !== undefined) updates.source_category_id = source_category_id || null;
    if (date_received !== undefined) updates.date_received = date_received;
    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return NextResponse.json({ error: 'Valid positive amount (UGX) is required' }, { status: 400 });
      }
      updates.amount = parsedAmount;
    }

    const supabase = createServiceClient();
    const { data, error } = await (supabase
      .from('finance_incomes') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ income: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update income entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/finance/incomes?id=...
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Income ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await (supabase
      .from('finance_incomes') as any)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to delete income entry' },
      { status: 500 }
    );
  }
}
