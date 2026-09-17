import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';

// GET /api/finance/expenses?edition_id=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('edition_id');

    if (!editionId) {
      return NextResponse.json({ error: 'edition_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('finance_expenses')
      .select('*')
      .eq('market_day_id', editionId)
      .order('date_incurred', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return NextResponse.json({ expenses: [], tableMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ expenses: data || [], tableMissing: false });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

// POST /api/finance/expenses
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const {
      market_day_id,
      category_id,
      category_name,
      description,
      amount,
      date_incurred,
      receipt_url,
    } = body;

    if (!market_day_id) {
      return NextResponse.json({ error: 'market_day_id (edition) is required' }, { status: 400 });
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description/note is required' }, { status: 400 });
    }
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ error: 'Valid positive amount (UGX) is required' }, { status: 400 });
    }
    if (!category_name?.trim()) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const payload = {
      market_day_id,
      category_id: category_id || null,
      category_name: category_name.trim(),
      description: description.trim(),
      amount: parsedAmount,
      date_incurred: date_incurred || new Date().toISOString().split('T')[0],
      receipt_url: receipt_url || null,
      created_by: auth.user?.id || null,
      created_by_email: auth.user?.email || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase
      .from('finance_expenses') as any)
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return NextResponse.json(
          {
            error:
              "Database table 'finance_expenses' does not exist yet. Please run 'add_finance_module.sql' in your Supabase SQL Editor.",
            tableMissing: true,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ expense: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to create expense entry' },
      { status: 500 }
    );
  }
}

// PATCH /api/finance/expenses
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { id, category_id, category_name, description, amount, date_incurred, receipt_url } = body;

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (description !== undefined) updates.description = description.trim();
    if (category_name !== undefined) updates.category_name = category_name.trim();
    if (category_id !== undefined) updates.category_id = category_id || null;
    if (date_incurred !== undefined) updates.date_incurred = date_incurred;
    if (receipt_url !== undefined) updates.receipt_url = receipt_url;
    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return NextResponse.json({ error: 'Valid positive amount (UGX) is required' }, { status: 400 });
      }
      updates.amount = parsedAmount;
    }

    const supabase = createServiceClient();
    const { data, error } = await (supabase
      .from('finance_expenses') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ expense: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update expense entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/finance/expenses?id=...
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await (supabase
      .from('finance_expenses') as any)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to delete expense entry' },
      { status: 500 }
    );
  }
}
