'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Briefcase, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface EditionJob {
  name: string;
  paidVendors: number;
  employees: number;
  casualWorkers: number;
  total: number;
}

interface JobsSupportedPanelProps {
  activeRegion: { id: string; name: string } | null;
  activeEdition: { id: string; name: string } | null;
  editions: { id: string; name: string }[];
}

const CustomJobsTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
  return (
    <div className="bg-[#1a1d24] border border-white/10 rounded-lg p-3 shadow-xl min-w-32 text-xs space-y-2 select-none">
      <p className="text-xs text-gray-400 border-b border-white/10 pb-1 mb-1">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex justify-between items-center gap-4">
            <span className="flex items-center gap-2 text-gray-300 font-medium">
              <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.color || entry.fill }} />
              {entry.name}
            </span>
            <span className="font-semibold text-white">{Number(entry.value).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="pt-1.5 border-t border-white/10 flex justify-between items-center font-bold">
        <span className="text-gray-400">Total Jobs</span>
        <span className="text-green-400">{total.toLocaleString()}</span>
      </div>
    </div>
  );
};

export const JobsSupportedPanel: React.FC<JobsSupportedPanelProps> = ({
  activeRegion,
  activeEdition,
  editions,
}) => {
  const [loading, setLoading] = useState(true);
  const [editionJobs, setEditionJobs] = useState<EditionJob[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRegion?.id) return;

    const fetchJobs = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        if (!supabase) throw new Error('Client not initialized');

        const editionIds = editions.map(e => e.id);
        const jobs: EditionJob[] = [];

        for (const ed of editions) {
          const [{ data: paidData }, { data: surveyData }] = await Promise.all([
            supabase
              .from('vendor_registrations')
              .select('id', { count: 'exact' })
              .eq('market_day_id', ed.id),
            supabase
              .from('survey_responses')
              .select(`
                survey_answers(
                  answer,
                  survey_questions!inner(csv_column)
                )
              `)
              .eq('context_id', ed.id)
              .eq('survey_answers.survey_questions.csv_column', 'number_of_employees'),
          ]);

          const paidVendors = paidData?.length || 0;

          let employees = 0;
          (surveyData || []).forEach((sr: any) => {
            const answers = sr.survey_answers || [];
            answers.forEach((a: any) => {
              if (a.survey_questions?.csv_column === 'number_of_employees' || a.survey_questions?.csv_column === 'employee_count') {
                const num = parseInt(a.answer);
                if (!isNaN(num) && num > 0 && num < 1000) employees += num;
              }
            });
          });

          const { data: casualData } = await supabase
            .from('survey_responses')
            .select(`
              survey_answers(
                answer,
                survey_questions!inner(csv_column)
              )
            `)
            .eq('context_id', ed.id)
            .eq('survey_answers.survey_questions.csv_column', 'casual_helpers_count');

          let casualWorkers = 0;
          (casualData || []).forEach((sr: any) => {
            const answers = sr.survey_answers || [];
            answers.forEach((a: any) => {
              if (a.survey_questions?.csv_column === 'casual_helpers_count') {
                const num = parseInt(a.answer);
                if (!isNaN(num) && num > 0 && num < 500) casualWorkers += num;
              }
            });
          });

          jobs.push({
            name: ed.name,
            paidVendors,
            employees,
            casualWorkers,
            total: paidVendors + employees + casualWorkers,
          });
        }

        setEditionJobs(jobs);
        setTotalJobs(jobs.reduce((s, j) => s + j.total, 0));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load jobs data');
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [activeRegion?.id, editions]);

  if (!activeRegion) {
    return (
      <div className="py-24 text-center select-none text-left animate-fade-in">
        <Briefcase className="w-12 h-12 text-text-muted mx-auto mb-3" />
        <h3 className="text-sm font-bold text-text-primary">No Region Selected</h3>
        <p className="text-xs text-text-secondary max-w-sm mx-auto mt-2">Select an active region to view jobs supported.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center select-none text-left animate-fade-in">
        <Loader2 className="w-8 h-8 animate-spin text-green mb-3" />
        <p className="text-xs text-text-secondary">Calculating jobs supported across editions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-24 text-center select-none text-left animate-fade-in">
        <p className="text-xs text-red">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in text-left">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Jobs Supported</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Total employment impact across {activeRegion.name} editions
          </p>
        </div>
        <Badge variant="success" size="md" className="text-sm font-extrabold">
          {totalJobs.toLocaleString()} total jobs
        </Badge>
      </div>

      {editionJobs.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-lg p-10 text-center select-none">
          <Briefcase className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-xs text-text-secondary">No edition data available for this region.</p>
        </div>
      ) : (
        <>
          <div className="bg-[#0f1117] border border-white/5 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-4 bg-green-500 rounded-full" />
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">
                Jobs Breakdown Per Edition
              </span>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={editionJobs} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                <defs>
                  <linearGradient id="jobsPaidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                    <stop offset="100%" stopColor="#15803d" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="jobsEmpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="jobsCasualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity={1} />
                    <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  dx={-4}
                />
                <Tooltip content={<CustomJobsTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', color: '#6b7280', paddingTop: '16px' }}
                />
                <Bar dataKey="paidVendors" name="Paid Vendors" stackId="a" fill="url(#jobsPaidGrad)" />
                <Bar dataKey="employees" name="Employees" stackId="a" fill="url(#jobsEmpGrad)" />
                <Bar dataKey="casualWorkers" name="Casual Workers" stackId="a" fill="url(#jobsCasualGrad)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {editionJobs.map((ed) => (
              <div key={ed.name} className="bg-bg-surface border border-border rounded-lg p-4">
                <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">{ed.name}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-text-secondary">Paid Vendors</span>
                    <span className="text-xs font-bold text-green">{ed.paidVendors.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-text-secondary">Employees</span>
                    <span className="text-xs font-bold text-blue">{ed.employees.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-text-secondary">Casual Workers</span>
                    <span className="text-xs font-bold text-purple-400">{ed.casualWorkers.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-[11px] font-bold text-text-primary">Total Jobs</span>
                    <span className="text-sm font-extrabold text-text-primary">{ed.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
