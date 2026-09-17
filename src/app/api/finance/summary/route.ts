import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isTestEdition } from '@/lib/editions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('edition_id');
    const regionId = searchParams.get('region_id');

    const supabase = createServiceClient();

    // 1. Single Edition Summary
    if (editionId) {
      // Try reading from edition_finance_summaries view
      let summaryData: any = null;
      const { data: viewRow, error: viewErr } = await supabase
        .from('edition_finance_summaries')
        .select('*')
        .eq('market_day_id', editionId)
        .maybeSingle();

      if (!viewErr && viewRow) {
        summaryData = {
          market_day_id: viewRow.market_day_id,
          region_id: viewRow.region_id,
          edition_name: viewRow.edition_title || viewRow.edition_name,
          event_date: viewRow.event_date,
          vendor_revenue: Number(viewRow.vendor_revenue) || 0,
          other_income: Number(viewRow.other_income) || 0,
          total_revenue: Number(viewRow.total_revenue) || 0,
          total_expenses: Number(viewRow.total_expenses) || 0,
          net_balance: Number(viewRow.net_balance) || 0,
          spend_rate_pct: viewRow.spend_rate_pct != null ? Number(viewRow.spend_rate_pct) : null,
        };
      } else {
        // Compute dynamically if view is missing or not populated
        const [mRes, vrRes, feRes, fiRes] = await Promise.all([
          supabase.from('market_days').select('id, name, edition, event_date, region_id').eq('id', editionId).maybeSingle(),
          supabase.from('vendor_registrations').select('amount_paid').eq('market_day_id', editionId),
          supabase.from('finance_expenses').select('amount, category_name').eq('market_day_id', editionId),
          supabase.from('finance_incomes').select('amount, source_category_name').eq('market_day_id', editionId),
        ]);

        const mRow = mRes.data;
        const vendorRevenue = (vrRes.data || []).reduce((acc: number, r: any) => acc + (Number(r.amount_paid) || 0), 0);
        const otherIncome = (fiRes.data || []).reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0);
        const totalRevenue = vendorRevenue + otherIncome;
        const totalExpenses = (feRes.data || []).reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0);
        const netBalance = totalRevenue - totalExpenses;
        const spendRate = totalRevenue > 0 ? Number(((totalExpenses / totalRevenue) * 100).toFixed(2)) : null;

        summaryData = {
          market_day_id: editionId,
          region_id: mRow?.region_id || null,
          edition_name: mRow?.edition || mRow?.name || 'Edition',
          event_date: mRow?.event_date || '',
          vendor_revenue: vendorRevenue,
          other_income: otherIncome,
          total_revenue: totalRevenue,
          total_expenses: totalExpenses,
          net_balance: netBalance,
          spend_rate_pct: spendRate,
        };
      }

      // Fetch detailed breakdowns for this edition
      const [feBreakdown, fiBreakdown] = await Promise.all([
        supabase
          .from('finance_expenses')
          .select('id, category_name, amount')
          .eq('market_day_id', editionId),
        supabase
          .from('finance_incomes')
          .select('id, source_category_name, amount')
          .eq('market_day_id', editionId),
      ]);

      // Aggregate expenses by category
      const expenseCatMap: Record<string, number> = {};
      (feBreakdown.data || []).forEach((row: any) => {
        const cat = row.category_name || 'Uncategorized';
        expenseCatMap[cat] = (expenseCatMap[cat] || 0) + (Number(row.amount) || 0);
      });

      const expenseBreakdown = Object.entries(expenseCatMap).map(([category, amount]) => ({
        category,
        amount,
        percentage: summaryData.total_expenses > 0
          ? Number(((amount / summaryData.total_expenses) * 100).toFixed(1))
          : 0,
      })).sort((a, b) => b.amount - a.amount);

      // Aggregate other income by source
      const incomeCatMap: Record<string, number> = {};
      (fiBreakdown.data || []).forEach((row: any) => {
        const cat = row.source_category_name || 'Other';
        incomeCatMap[cat] = (incomeCatMap[cat] || 0) + (Number(row.amount) || 0);
      });

      const incomeBreakdown = [
        {
          source: 'Vendor Slot Sales',
          amount: summaryData.vendor_revenue,
          percentage: summaryData.total_revenue > 0
            ? Number(((summaryData.vendor_revenue / summaryData.total_revenue) * 100).toFixed(1))
            : 0,
        },
        ...Object.entries(incomeCatMap).map(([source, amount]) => ({
          source,
          amount,
          percentage: summaryData.total_revenue > 0
            ? Number(((amount / summaryData.total_revenue) * 100).toFixed(1))
            : 0,
        })),
      ];

      return NextResponse.json({
        summary: summaryData,
        expenseBreakdown,
        incomeBreakdown,
      });
    }

    // 2. Cross-Edition Trends / Regional Summaries
    // Fetch all market_days (filtered by region if provided)
    let editionsQuery = supabase
      .from('market_days')
      .select('id, name, edition, event_date, region_id, status, regions(name)')
      .order('event_date', { ascending: true });

    if (regionId && regionId !== 'all') {
      editionsQuery = editionsQuery.eq('region_id', regionId);
    }

    const { data: rawEditions, error: edErr } = await editionsQuery;
    if (edErr) throw edErr;

    const filteredEditions = (rawEditions || []).filter((ed: any) => !isTestEdition(ed));

    // Try reading view first
    const { data: viewRows } = await supabase
      .from('edition_finance_summaries')
      .select('*');

    const viewMap = new Map((viewRows || []).map((r: any) => [r.market_day_id, r]));

    // Fetch vendor registrations and finance items if view missing
    const editionIds = filteredEditions.map((e: any) => e.id);
    let vrMap = new Map<string, number>();
    let feMap = new Map<string, number>();
    let fiMap = new Map<string, number>();

    if (editionIds.length > 0 && viewRows?.length === 0) {
      const [allVr, allFe, allFi] = await Promise.all([
        supabase.from('vendor_registrations').select('market_day_id, amount_paid').in('market_day_id', editionIds),
        supabase.from('finance_expenses').select('market_day_id, amount').in('market_day_id', editionIds),
        supabase.from('finance_incomes').select('market_day_id, amount').in('market_day_id', editionIds),
      ]);

      (allVr.data || []).forEach((r: any) => {
        vrMap.set(r.market_day_id, (vrMap.get(r.market_day_id) || 0) + (Number(r.amount_paid) || 0));
      });
      (allFe.data || []).forEach((r: any) => {
        feMap.set(r.market_day_id, (feMap.get(r.market_day_id) || 0) + (Number(r.amount) || 0));
      });
      (allFi.data || []).forEach((r: any) => {
        fiMap.set(r.market_day_id, (fiMap.get(r.market_day_id) || 0) + (Number(r.amount) || 0));
      });
    }

    const trends = filteredEditions.map((ed: any) => {
      const v = viewMap.get(ed.id);
      const vendorRev = v ? Number(v.vendor_revenue) || 0 : vrMap.get(ed.id) || 0;
      const otherInc = v ? Number(v.other_income) || 0 : fiMap.get(ed.id) || 0;
      const totalRev = v ? Number(v.total_revenue) || 0 : vendorRev + otherInc;
      const totalExp = v ? Number(v.total_expenses) || 0 : feMap.get(ed.id) || 0;
      const netBal = v ? Number(v.net_balance) || 0 : totalRev - totalExp;
      const spendRate = totalRev > 0 ? Number(((totalExp / totalRev) * 100).toFixed(2)) : null;

      return {
        edition_id: ed.id,
        edition_name: ed.edition || ed.name || 'Untitled',
        event_date: ed.event_date || '',
        region_id: ed.region_id,
        region_name: ed.regions?.name || 'General',
        vendor_revenue: vendorRev,
        other_income: otherInc,
        total_revenue: totalRev,
        total_expenses: totalExp,
        net_balance: netBal,
        spend_rate_pct: spendRate,
      };
    });

    return NextResponse.json({ trends });
  } catch (err: any) {
    console.error('Finance summary route error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate financial summary' },
      { status: 500 }
    );
  }
}
