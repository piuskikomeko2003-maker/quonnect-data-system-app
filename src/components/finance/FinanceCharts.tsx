'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, PieChart as PieIcon, BarChart3 } from 'lucide-react';

const CATEGORY_COLORS = [
  '#1d4ed8', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#64748b', // Slate
  '#ef4444', // Red
  '#14b8a6', // Teal
];

interface ExpenseCategoryItem {
  category: string;
  amount: number;
  percentage: number;
}

interface IncomeSourceItem {
  source: string;
  amount: number;
  percentage: number;
}

interface FinanceChartsProps {
  expenseBreakdown: ExpenseCategoryItem[];
  incomeBreakdown: IncomeSourceItem[];
  totalExpenses: number;
  totalRevenue: number;
}

const CustomExpenseTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-border rounded-lg p-3 shadow-modal text-xs space-y-1 select-none">
      <p className="font-semibold text-text-primary">{data.category}</p>
      <div className="flex justify-between items-center gap-4 text-text-secondary">
        <span>Amount:</span>
        <span className="font-bold text-text-primary">UGX {Number(data.amount).toLocaleString()}</span>
      </div>
      <div className="flex justify-between items-center gap-4 text-text-secondary">
        <span>Share:</span>
        <span className="font-bold text-accent">{data.percentage}%</span>
      </div>
    </div>
  );
};

const CustomIncomeTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-border rounded-lg p-3 shadow-modal text-xs space-y-1 select-none">
      <p className="font-semibold text-text-primary">{data.source}</p>
      <div className="flex justify-between items-center gap-4 text-text-secondary">
        <span>Amount:</span>
        <span className="font-bold text-text-primary">UGX {Number(data.amount).toLocaleString()}</span>
      </div>
      <div className="flex justify-between items-center gap-4 text-text-secondary">
        <span>Share:</span>
        <span className="font-bold text-green">{data.percentage}%</span>
      </div>
    </div>
  );
};

export const FinanceCharts: React.FC<FinanceChartsProps> = ({
  expenseBreakdown,
  incomeBreakdown,
  totalExpenses,
  totalRevenue,
}) => {
  const [expenseChartType, setExpenseChartType] = React.useState<'bar' | 'donut'>('bar');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Expense Breakdown by Category */}
      <div className="bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-red rounded-full" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Expense Breakdown by Category
            </span>
          </div>
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-bg-elevated">
            <button
              onClick={() => setExpenseChartType('bar')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                expenseChartType === 'bar'
                  ? 'bg-white text-text-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="Bar View"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Bar</span>
            </button>
            <button
              onClick={() => setExpenseChartType('donut')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                expenseChartType === 'donut'
                  ? 'bg-white text-text-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="Donut View"
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Donut</span>
            </button>
          </div>
        </div>

        {expenseBreakdown.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-text-muted text-xs">
            <DollarSign className="w-8 h-8 stroke-1 mb-2" />
            <p>No expense entries added yet for this edition.</p>
          </div>
        ) : (
          <div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {expenseChartType === 'bar' ? (
                  <BarChart
                    data={expenseBreakdown}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e9ee" />
                    <XAxis
                      type="number"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fill: '#111827', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={120}
                    />
                    <Tooltip content={<CustomExpenseTooltip />} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {expenseBreakdown.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {expenseBreakdown.map((_, index) => (
                        <Cell
                          key={`cell-donut-${index}`}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomExpenseTooltip />} />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: '10px', color: '#6b7280', paddingTop: '10px' }}
                    />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Compact Breakdown Table */}
            <div className="mt-4 pt-3 border-t border-border overflow-x-auto max-h-40 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-text-secondary border-b border-border/60 pb-1 font-medium">
                    <th className="pb-1.5 font-medium">Category</th>
                    <th className="pb-1.5 font-medium text-right">Amount (UGX)</th>
                    <th className="pb-1.5 font-medium text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {expenseBreakdown.map((item, idx) => (
                    <tr key={item.category} className="hover:bg-bg-elevated/40">
                      <td className="py-1.5 flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                        />
                        <span className="font-medium text-text-primary truncate max-w-[160px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-semibold text-text-primary">
                        {item.amount.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right text-text-secondary">
                        {item.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 2. Income Breakdown (Vendor vs Other Sources) */}
      <div className="bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-green rounded-full" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Income Breakdown (Vendor Sales vs Others)
            </span>
          </div>
        </div>

        {totalRevenue === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-text-muted text-xs">
            <DollarSign className="w-8 h-8 stroke-1 mb-2" />
            <p>No revenue recorded yet for this edition.</p>
          </div>
        ) : (
          <div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incomeBreakdown}
                    dataKey="amount"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {incomeBreakdown.map((_, index) => (
                      <Cell
                        key={`cell-inc-${index}`}
                        fill={index === 0 ? '#10b981' : CATEGORY_COLORS[(index + 2) % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomIncomeTooltip />} />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', color: '#6b7280', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Compact Breakdown Table */}
            <div className="mt-4 pt-3 border-t border-border overflow-x-auto max-h-40 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-text-secondary border-b border-border/60 pb-1 font-medium">
                    <th className="pb-1.5 font-medium">Revenue Source</th>
                    <th className="pb-1.5 font-medium text-right">Amount (UGX)</th>
                    <th className="pb-1.5 font-medium text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {incomeBreakdown.map((item, idx) => (
                    <tr key={item.source} className="hover:bg-bg-elevated/40">
                      <td className="py-1.5 flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full inline-block shrink-0"
                          style={{
                            backgroundColor:
                              idx === 0
                                ? '#10b981'
                                : CATEGORY_COLORS[(idx + 2) % CATEGORY_COLORS.length],
                          }}
                        />
                        <span className="font-medium text-text-primary truncate max-w-[160px]">
                          {item.source}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-semibold text-text-primary">
                        {item.amount.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right text-text-secondary">
                        {item.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
