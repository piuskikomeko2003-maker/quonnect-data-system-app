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
          <div className="bg-bg-surface border border-border rounded-lg p-5">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4">
              Jobs Breakdown Per Edition
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={editionJobs} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#8b949e', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#21262d' }}
                />
                <YAxis
                  tick={{ fill: '#8b949e', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#21262d' }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#c9d1d9',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', color: '#8b949e' }}
                />
                <Bar dataKey="paidVendors" name="Paid Vendors" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="employees" name="Employees" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="casualWorkers" name="Casual Workers" stackId="a" fill="#c084fc" radius={[4, 4, 0, 0]} />
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
