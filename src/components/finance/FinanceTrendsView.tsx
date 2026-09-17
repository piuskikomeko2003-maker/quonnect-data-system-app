'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Filter,
  Check,
  Calendar,
  Layers,
  BarChart3,
  LineChart as LineChartIcon,
  Loader2,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { useRegion } from '@/context/RegionContext';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { CrossEditionTrendPoint } from '@/types/finance';

const CustomTrendsTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as CrossEditionTrendPoint;
  if (!point) return null;

  return (
    <div className="bg-white border border-border rounded-xl p-4 shadow-modal text-xs space-y-2 select-none min-w-56">
      <div className="border-b border-border pb-1.5 mb-1.5">
        <p className="font-bold text-text-primary text-sm">{point.edition_name}</p>
        <p className="text-[11px] text-text-secondary">{point.event_date || 'No date'} • {point.region_name || 'General'}</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue" />
            Total Revenue:
          </span>
          <span className="font-bold text-blue">UGX {point.total_revenue.toLocaleString()}</span>
        </div>
        <div className="pl-3 text-[10px] text-text-tertiary flex justify-between">
          <span>Vendor Sales:</span>
          <span>UGX {point.vendor_revenue.toLocaleString()}</span>
        </div>
        <div className="pl-3 text-[10px] text-text-tertiary flex justify-between">
          <span>Other Incomes:</span>
          <span>UGX {point.other_income.toLocaleString()}</span>
        </div>

        <div className="flex justify-between items-center text-text-secondary pt-1 border-t border-border/40">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red" />
            Total Expenses:
          </span>
          <span className="font-bold text-red">UGX {point.total_expenses.toLocaleString()}</span>
        </div>

        <div className="flex justify-between items-center text-text-secondary pt-1 border-t border-border">
          <span className="flex items-center gap-1.5 font-semibold text-text-primary">
            <span className="w-2 h-2 rounded-full bg-green" />
            Net Balance (Profit):
          </span>
          <span className={`font-bold ${point.net_balance >= 0 ? 'text-green' : 'text-red'}`}>
            UGX {point.net_balance.toLocaleString()}
          </span>
        </div>

        {point.spend_rate_pct != null && (
          <div className="flex justify-between items-center text-[10px] text-text-secondary pt-0.5">
            <span>Spend Rate:</span>
            <span className="font-semibold">{point.spend_rate_pct}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const FinanceTrendsView: React.FC = () => {
  const { regions, activeRegion, switchRegion } = useRegion();

  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<CrossEditionTrendPoint[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('all');
  const [selectedEditionIds, setSelectedEditionIds] = useState<Set<string>>(new Set());
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Series visibility toggles (User requirement: independent toggles for Profit, Income, Expenses)
  const [showProfit, setShowProfit] = useState(true);
  const [showIncome, setShowIncome] = useState(true);
  const [showExpenses, setShowExpenses] = useState(true);

  // Sync with activeRegion if set initially
  useEffect(() => {
    if (activeRegion?.id) {
      setSelectedRegionId(activeRegion.id);
    } else {
      setSelectedRegionId('all');
    }
  }, [activeRegion?.id]);

  const fetchTrends = async (regionId: string) => {
    setLoading(true);
    try {
      const url = regionId === 'all'
        ? '/api/finance/summary'
        : `/api/finance/summary?region_id=${regionId}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load trends');

      const pts: CrossEditionTrendPoint[] = data.trends || [];
      setTrends(pts);

      // Default edition multi-select: all editions in this scope selected
      setSelectedEditionIds(new Set(pts.map((p) => p.edition_id)));
    } catch (err) {
      console.error('Error fetching finance trends:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends(selectedRegionId);
  }, [selectedRegionId]);

  const handleRegionChange = (newRegId: string) => {
    setSelectedRegionId(newRegId);
    if (newRegId !== 'all') {
      const found = regions.find((r) => r.id === newRegId);
      if (found) switchRegion(found);
    }
  };

  const toggleEditionSelection = (id: string) => {
    const next = new Set(selectedEditionIds);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id); // Keep at least 1 selected
    } else {
      next.add(id);
    }
    setSelectedEditionIds(next);
  };

  const selectAllEditions = () => {
    setSelectedEditionIds(new Set(trends.map((t) => t.edition_id)));
  };

  // Filtered dataset according to user edition multi-select
  const chartData = useMemo(() => {
    return trends.filter((t) => selectedEditionIds.has(t.edition_id));
  }, [trends, selectedEditionIds]);

  // Aggregate totals across selected editions
  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, cur) => {
        acc.revenue += cur.total_revenue;
        acc.expenses += cur.total_expenses;
        acc.profit += cur.net_balance;
        return acc;
      },
      { revenue: 0, expenses: 0, profit: 0 }
    );
  }, [chartData]);

  return (
    <div className="space-y-6 animate-card-entrance">
      {/* Top Filter and Customization Bar */}
      <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Cross-Edition Finance Trends</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Historical multi-series comparison of profit, revenue, and expenses across editions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Region Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-secondary">Region:</span>
              <select
                value={selectedRegionId}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="h-8 px-3 border border-border rounded-lg text-xs font-medium bg-white text-text-primary focus:outline-hidden focus:border-accent"
              >
                <option value="all">All Regions</option>
                {regions.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Line / Bar Chart Toggle */}
            <div className="flex border border-border rounded-lg p-0.5 bg-bg-elevated">
              <button
                onClick={() => setChartType('line')}
                className={`p-1.5 rounded-md transition-all ${
                  chartType === 'line'
                    ? 'bg-white text-text-primary shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Line Trend"
              >
                <LineChartIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded-md transition-all ${
                  chartType === 'bar'
                    ? 'bg-white text-text-primary shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Bar Comparison"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => fetchTrends(selectedRegionId)}
              disabled={loading}
              className="p-1.5 border border-border rounded-lg text-text-secondary hover:text-accent hover:border-accent transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Series Visibility Toggles */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-secondary mr-1">Visible Series:</span>
            {/* Profit Toggle */}
            <button
              type="button"
              onClick={() => setShowProfit(!showProfit)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                showProfit
                  ? 'bg-green-muted text-green border-green/40'
                  : 'bg-white text-text-muted border-border hover:border-text-muted'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showProfit ? 'bg-green' : 'bg-text-muted'}`} />
              Profit (Net Balance)
            </button>

            {/* Revenue Toggle */}
            <button
              type="button"
              onClick={() => setShowIncome(!showIncome)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                showIncome
                  ? 'bg-blue-muted text-blue border-blue/40'
                  : 'bg-white text-text-muted border-border hover:border-text-muted'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showIncome ? 'bg-blue' : 'bg-text-muted'}`} />
              Total Revenue
            </button>

            {/* Expense Toggle */}
            <button
              type="button"
              onClick={() => setShowExpenses(!showExpenses)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                showExpenses
                  ? 'bg-red-muted text-red border-red/40'
                  : 'bg-white text-text-muted border-border hover:border-text-muted'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showExpenses ? 'bg-red' : 'bg-text-muted'}`} />
              Total Expenses
            </button>
          </div>

          <div className="text-xs text-text-secondary">
            Editions plotted:{' '}
            <strong className="text-text-primary">{chartData.length}</strong> of{' '}
            {trends.length}
          </div>
        </div>

        {/* Edition Multi-Select Chips */}
        {trends.length > 0 && (
          <div className="pt-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-text-secondary uppercase tracking-wider">
                Select Specific Editions to Compare:
              </span>
              <button
                type="button"
                onClick={selectAllEditions}
                className="text-accent font-medium hover:underline text-xs"
              >
                Select All
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {trends.map((pt) => {
                const isSelected = selectedEditionIds.has(pt.edition_id);
                return (
                  <button
                    key={pt.edition_id}
                    type="button"
                    onClick={() => toggleEditionSelection(pt.edition_id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-accent/10 border-accent/40 text-accent font-semibold'
                        : 'bg-white border-border text-text-secondary hover:border-text-muted'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-accent" />}
                    <span>{pt.edition_name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Aggregate Cumulative KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cumulative Revenue */}
        <div
          className="group relative overflow-hidden bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-elevated hover:border-blue/40 animate-card-entrance cursor-default"
          style={{ animationDelay: '0ms' }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider group-hover:text-text-primary transition-colors">
              Cumulative Revenue (Selected)
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-muted text-blue flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 group-hover:bg-blue group-hover:text-white shadow-xs">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 text-2xl font-bold text-blue tracking-tight">
            <span className="text-xs font-semibold text-text-secondary">UGX</span>
            <AnimatedNumber value={totals.revenue} />
          </div>
        </div>

        {/* Cumulative Expenses */}
        <div
          className="group relative overflow-hidden bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-elevated hover:border-red/40 animate-card-entrance cursor-default"
          style={{ animationDelay: '80ms' }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider group-hover:text-text-primary transition-colors">
              Cumulative Expenses (Selected)
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-muted text-red flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-red group-hover:text-white shadow-xs">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 text-2xl font-bold text-red tracking-tight">
            <span className="text-xs font-semibold text-text-secondary">UGX</span>
            <AnimatedNumber value={totals.expenses} />
          </div>
        </div>

        {/* Net Regional Profit */}
        <div
          className={`group relative overflow-hidden rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-elevated animate-card-entrance cursor-default ${
            totals.profit >= 0
              ? 'bg-white border border-green/30 hover:border-green'
              : 'bg-red-50/20 border border-red/40 hover:border-red'
          }`}
          style={{ animationDelay: '160ms' }}
        >
          <div
            className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
              totals.profit >= 0 ? 'via-green' : 'via-red'
            } to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
          />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider group-hover:text-text-primary transition-colors">
              Net Regional Profit
            </span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 shadow-xs ${
                totals.profit >= 0
                  ? 'bg-green-muted text-green group-hover:bg-green group-hover:text-white'
                  : 'bg-red-muted text-red group-hover:bg-red group-hover:text-white'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={`flex items-baseline gap-1 text-2xl font-extrabold tracking-tight ${
              totals.profit >= 0 ? 'text-green' : 'text-red'
            }`}
          >
            <span className="text-xs font-semibold">UGX</span>
            {totals.profit >= 0 ? (
              <AnimatedNumber value={totals.profit} />
            ) : (
              <span>- <AnimatedNumber value={Math.abs(totals.profit)} /></span>
            )}
          </div>
        </div>
      </div>

      {/* The Multi-Series Trend Chart */}
      <div className="bg-white border border-border rounded-xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-4 bg-accent rounded-full" />
          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
            Financial Trajectory Over Editions
          </span>
        </div>

        {loading ? (
          <div className="h-80 flex flex-col items-center justify-center text-text-muted">
            <Loader2 className="w-6 h-6 animate-spin mb-2 text-accent" />
            <span className="text-xs">Computing edition financial trends...</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-text-muted">
            <Calendar className="w-8 h-8 stroke-1 mb-2" />
            <span className="text-xs">No edition data available for the selected filters.</span>
          </div>
        ) : (
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e9ee" vertical={false} />
                  <XAxis
                    dataKey="edition_name"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip content={<CustomTrendsTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', color: '#6b7280', paddingTop: '20px' }}
                  />
                  {showIncome && (
                    <Line
                      type="monotone"
                      dataKey="total_revenue"
                      name="Total Revenue"
                      stroke="#1d4ed8"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#1d4ed8' }}
                      activeDot={{ r: 6 }}
                    />
                  )}
                  {showExpenses && (
                    <Line
                      type="monotone"
                      dataKey="total_expenses"
                      name="Total Expenses"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#ef4444' }}
                      activeDot={{ r: 6 }}
                    />
                  )}
                  {showProfit && (
                    <Line
                      type="monotone"
                      dataKey="net_balance"
                      name="Net Profit (Balance)"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#10b981' }}
                      activeDot={{ r: 7 }}
                    />
                  )}
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e9ee" vertical={false} />
                  <XAxis
                    dataKey="edition_name"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip content={<CustomTrendsTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', color: '#6b7280', paddingTop: '20px' }}
                  />
                  {showIncome && (
                    <Bar
                      dataKey="total_revenue"
                      name="Total Revenue"
                      fill="#1d4ed8"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {showExpenses && (
                    <Bar
                      dataKey="total_expenses"
                      name="Total Expenses"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {showProfit && (
                    <Bar
                      dataKey="net_balance"
                      name="Net Profit (Balance)"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
