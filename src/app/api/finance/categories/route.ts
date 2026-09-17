import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { FinanceCategory } from '@/types/finance';

const DEFAULT_EXPENSE_CATEGORIES = [
  'Employees & Wages',
  'Transportation',
  'Management & Supervision',
  'Ushers & Stewards',
  'Food & Refreshments',
  'Venue & Permits',
  'Marketing & Publicity',
  'Equipment & Sound',
  'Miscellaneous',
];

const DEFAULT_INCOME_CATEGORIES = [
  'Sponsorships',
  'Donations & Grants',
  'Gate / Entry Fees',
  'Merchandise Sales',
  'Other Income',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const supabase = createServiceClient();
    let query = supabase.from('finance_categories').select('*').order('name', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        // Fallback to static defaults if DB migration has not yet been applied
        const fallback: FinanceCategory[] = [];
        if (!type || type === 'expense') {
          DEFAULT_EXPENSE_CATEGORIES.forEach((name, idx) => {
            fallback.push({
              id: `fallback-exp-${idx}`,
              name,
              type: 'expense',
              is_default: true,
            });
          });
        }
        if (!type || type === 'income') {
          DEFAULT_INCOME_CATEGORIES.forEach((name, idx) => {
            fallback.push({
              id: `fallback-inc-${idx}`,
              name,
              type: 'income',
              is_default: true,
            });
          });
        }
        return NextResponse.json({ categories: fallback, tableMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ categories: data || [], tableMissing: false });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { name, type, description } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Category name and type (expense/income) are required' },
        { status: 400 }
      );
    }

    if (type !== 'expense' && type !== 'income') {
      return NextResponse.json(
        { error: 'Type must be either "expense" or "income"' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await (supabase
      .from('finance_categories') as any)
      .insert({
        name: name.trim(),
        type,
        description: description?.trim() || null,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Category "${name}" already exists for ${type}s.` },
          { status: 409 }
        );
      }
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return NextResponse.json(
          {
            error:
              "Database table 'finance_categories' does not exist yet. Please run 'add_finance_module.sql' in your Supabase SQL Editor.",
            tableMissing: true,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ category: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: existing } = await (supabase
      .from('finance_categories') as any)
      .select('is_default, name')
      .eq('id', id)
      .maybeSingle();

    if (existing?.is_default) {
      return NextResponse.json(
        { error: `Default category "${existing.name}" cannot be deleted.` },
        { status: 400 }
      );
    }

    const { error } = await (supabase
      .from('finance_categories') as any)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to delete category' },
      { status: 500 }
    );
  }
}
