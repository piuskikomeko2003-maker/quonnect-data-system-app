import React from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';

export interface FilterState {
  region: string;
  editionId: string;
  gender: 'All' | 'Female' | 'Male' | 'Other';
  statuses: string[];
  minAge: number | '';
  maxAge: number | '';
  businessType: string;
  registrationType?: 'All' | 'Paid' | 'Collected';
}

export interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (updatedFilters: Partial<FilterState>) => void;
  editions: Array<{ id: string; name: string }>;
  businessTypes: string[];
  onClearFilters: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  editions,
  businessTypes,
  onClearFilters
}) => {
  const regions = [
    { value: 'All', label: 'All Regions' },
    { value: 'Kampala', label: 'Kampala' },
    { value: 'Jinja', label: 'Jinja' },
    { value: 'Mbarara', label: 'Mbarara' }
  ];

  const genders: Array<FilterState['gender']> = ['All', 'Female', 'Male', 'Other'];
  const availableStatuses = ['New', 'Active', 'Loyal', 'Dormant'];

  const handleStatusToggle = (status: string) => {
    const isSelected = filters.statuses.includes(status);
    const updatedStatuses = isSelected
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ statuses: updatedStatuses });
  };

  // Determine if any filters are active (non-default)
  const hasActiveFilters = 
    filters.region !== 'All' || 
    filters.gender !== 'All' || 
    filters.statuses.length > 0 || 
    filters.minAge !== '' || 
    filters.maxAge !== '' || 
    filters.businessType !== 'All' ||
    (filters.registrationType && filters.registrationType !== 'All');

  return (
    <div className="flex flex-col gap-4 bg-bg-surface border border-border rounded-lg p-4 mb-6">
      {/* Primary filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter Indicator Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated border border-border-light rounded-full text-text-secondary text-[11px] font-semibold">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
        </div>

        {/* Region Dropdown */}
        <select
          value={filters.region}
          onChange={(e) => onFiltersChange({ region: e.target.value })}
          className="bg-bg-elevated border border-border-light text-text-primary text-xs rounded-md px-3.5 py-2 cursor-pointer outline-none transition-colors focus:border-green appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 min-w-[130px]"
        >
          {regions.map((r) => (
            <option key={r.value} value={r.value} className="bg-bg-surface">
              {r.label}
            </option>
          ))}
        </select>

        {/* Registration Type Dropdown */}
        <select
          value={filters.registrationType || 'All'}
          onChange={(e) => onFiltersChange({ registrationType: e.target.value as any })}
          className="bg-bg-elevated border border-border-light text-text-primary text-xs rounded-md px-3.5 py-2 cursor-pointer outline-none transition-colors focus:border-green appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 min-w-[155px]"
        >
          <option value="All" className="bg-bg-surface">All Registrations</option>
          <option value="Paid" className="bg-bg-surface">Paid Vendors Only</option>
          <option value="Collected" className="bg-bg-surface">Field Collections Only</option>
        </select>

        {/* Business Type Dropdown */}
        <select
          value={filters.businessType}
          onChange={(e) => onFiltersChange({ businessType: e.target.value })}
          className="bg-bg-elevated border border-border-light text-text-primary text-xs rounded-md px-3.5 py-2 cursor-pointer outline-none transition-colors focus:border-green appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 min-w-[150px]"
        >
          <option value="All" className="bg-bg-surface">All Business Types</option>
          {businessTypes.map((t) => (
            <option key={t} value={t} className="bg-bg-surface">
              {t}
            </option>
          ))}
        </select>

        {/* Gender selector chips */}
        <div className="flex items-center bg-bg-elevated border border-border-light rounded-md p-0.5">
          {genders.map((g) => (
            <button
              key={g}
              onClick={() => onFiltersChange({ gender: g })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filters.gender === g
                  ? 'bg-green text-black font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Status multi-select chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {availableStatuses.map((s) => {
            const isSelected = filters.statuses.includes(s);
            return (
              <button
                key={s}
                onClick={() => handleStatusToggle(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-green-muted text-green border-green font-bold'
                    : 'bg-bg-elevated text-text-secondary border-border-light hover:text-text-primary'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Age Min-Max inputs */}
        <div className="flex items-center gap-1 bg-bg-elevated border border-border-light rounded-md px-2 py-0.5 min-w-[150px]">
          <span className="text-[10px] text-text-tertiary uppercase font-bold select-none pr-1">Age</span>
          <input
            type="number"
            placeholder="Min"
            value={filters.minAge}
            onChange={(e) => {
              const val = e.target.value === '' ? '' : parseInt(e.target.value);
              onFiltersChange({ minAge: val });
            }}
            className="w-12 bg-transparent text-text-primary text-xs font-semibold outline-none text-center"
          />
          <span className="text-text-tertiary text-xs select-none">—</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxAge}
            onChange={(e) => {
              const val = e.target.value === '' ? '' : parseInt(e.target.value);
              onFiltersChange({ maxAge: val });
            }}
            className="w-12 bg-transparent text-text-primary text-xs font-semibold outline-none text-center"
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="clear"
            size="sm"
            onClick={onClearFilters}
            className="ml-auto"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear filters</span>
          </Button>
        )}
      </div>

      {/* Edition selector chips row (Keep exact style from HTML) */}
      <div className="border-t border-border pt-3.5 flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest select-none">Editions:</span>
        <div className="flex bg-bg-elevated border border-border rounded-md p-1.5 gap-1 overflow-x-auto shrink-0 select-none">
          {editions.map((e) => (
            <button
              key={e.id}
              onClick={() => onFiltersChange({ editionId: e.id })}
              className={`px-3 py-1 rounded-sm text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filters.editionId === e.id
                  ? 'bg-green text-black font-extrabold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {e.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
