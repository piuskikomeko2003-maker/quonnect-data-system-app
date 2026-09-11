import React from 'react';
import { Question, SkipLogic, SkipCondition } from './types';
import { Button } from '../ui/Button';
import { Plus, Trash2, GitFork, HelpCircle } from 'lucide-react';
import { Input, Select } from '../ui';

export interface SkipLogicBuilderProps {
  currentQuestion: Question;
  previousQuestions: Question[];
  onChange: (skipLogic: SkipLogic) => void;
}

export const SkipLogicBuilder: React.FC<SkipLogicBuilderProps> = ({
  currentQuestion,
  previousQuestions,
  onChange
}) => {
  const skipLogic = currentQuestion.skipLogic || { enabled: false, logicalOperator: 'AND', conditions: [] };

  const handleToggleEnable = (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    
    // Seed with a default condition if enabling and empty
    let conditions = [...skipLogic.conditions];
    if (enabled && conditions.length === 0 && previousQuestions.length > 0) {
      conditions.push({
        id: Math.random().toString(36).substring(7),
        fieldId: previousQuestions[0].id,
        operator: 'is',
        value: ''
      });
    }

    onChange({
      ...skipLogic,
      enabled,
      conditions
    });
  };

  const handleAddCondition = () => {
    if (previousQuestions.length === 0) return;
    const newCondition: SkipCondition = {
      id: Math.random().toString(36).substring(7),
      fieldId: previousQuestions[0].id,
      operator: 'is',
      value: ''
    };
    onChange({
      ...skipLogic,
      conditions: [...skipLogic.conditions, newCondition]
    });
  };

  const handleRemoveCondition = (id: string) => {
    const updatedConditions = skipLogic.conditions.filter(c => c.id !== id);
    onChange({
      ...skipLogic,
      conditions: updatedConditions,
      // Disable if all conditions are removed
      enabled: updatedConditions.length > 0 ? skipLogic.enabled : false
    });
  };

  const handleConditionChange = (id: string, updates: Partial<SkipCondition>) => {
    const updatedConditions = skipLogic.conditions.map(c => {
      if (c.id === id) {
        return { ...c, ...updates };
      }
      return c;
    });
    onChange({
      ...skipLogic,
      conditions: updatedConditions
    });
  };

  const handleOperatorToggle = () => {
    onChange({
      ...skipLogic,
      logicalOperator: skipLogic.logicalOperator === 'AND' ? 'OR' : 'AND'
    });
  };

  const operatorOptions = [
    { value: 'is', label: 'is equal to' },
    { value: 'is_not', label: 'is not equal to' },
    { value: 'contains', label: 'contains text' },
    { value: 'gt', label: 'is greater than' },
    { value: 'lt', label: 'is less than' }
  ];

  const prevQuestionOptions = previousQuestions.map(q => ({
    value: q.id,
    label: q.text.length > 40 ? `${q.text.substring(0, 40)}...` : q.text
  }));

  if (previousQuestions.length === 0) {
    return (
      <div className="bg-slate-50 border border-border rounded-lg p-3.5 text-left text-[11px] text-text-tertiary select-none">
        <div className="flex items-center gap-2 font-medium">
          <HelpCircle className="w-4.5 h-4.5 shrink-0" />
          <span>Skip logic unavailable. Add previous questions first to set branching rules.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-border rounded-xl p-4 text-left select-none space-y-4">
      {/* Enable Toggle Switch */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold text-text-primary">Conditional Branching (Skip Logic)</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={skipLogic.enabled} 
            onChange={handleToggleEnable}
            className="sr-only peer"
          />
          <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white" />
        </label>
      </div>

      {skipLogic.enabled && skipLogic.conditions.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border/60 animate-fade-in">
          {/* AND/OR Operator Toggle for multiple conditions */}
          {skipLogic.conditions.length > 1 && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-text-tertiary uppercase select-none">
              <span>Match</span>
              <button
                type="button"
                onClick={handleOperatorToggle}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-accent font-extrabold text-[10px] cursor-pointer"
              >
                {skipLogic.logicalOperator}
              </button>
              <span>of the conditions below:</span>
            </div>
          )}

          {/* Condition list */}
          <div className="space-y-3">
            {skipLogic.conditions.map((condition, index) => (
              <div key={condition.id} className="flex flex-col sm:flex-row items-center gap-2.5 bg-white border border-border rounded-lg p-2.5 relative">
                {/* Condition row number/connector label */}
                <span className="absolute -left-2 top-3 w-4.5 h-4.5 bg-slate-100 text-text-secondary font-bold text-[9px] rounded-full flex items-center justify-center select-none shadow-xs border border-border">
                  {index + 1}
                </span>

                {/* Left: Previous Question Select */}
                <div className="w-full sm:flex-1 pl-2">
                  <Select
                    options={prevQuestionOptions}
                    value={condition.fieldId}
                    onChange={(e) => handleConditionChange(condition.id, { fieldId: e.target.value })}
                    className="py-1 px-2.5 text-[11px]"
                  />
                </div>

                {/* Middle: Operator Select */}
                <div className="w-full sm:w-[130px]">
                  <Select
                    options={operatorOptions}
                    value={condition.operator}
                    onChange={(e) => handleConditionChange(condition.id, { operator: e.target.value as any })}
                    className="py-1 px-2.5 text-[11px]"
                  />
                </div>

                {/* Right: Target Value Input */}
                <div className="w-full sm:w-[120px]">
                  <input
                    type="text"
                    placeholder="value"
                    value={condition.value}
                    onChange={(e) => handleConditionChange(condition.id, { value: e.target.value })}
                    className="w-full bg-slate-50 border border-border focus:border-accent focus:bg-white rounded-md px-2.5 py-1 text-text-primary text-[11px] font-sans placeholder-text-muted outline-none transition-colors"
                  />
                </div>

                {/* Delete Condition Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveCondition(condition.id)}
                  className="p-1 rounded text-text-tertiary hover:text-red-600 hover:bg-red-50 shrink-0 cursor-pointer"
                  title="Remove Condition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add condition link */}
          <button
            type="button"
            onClick={handleAddCondition}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:text-accent-hover cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add display condition</span>
          </button>
        </div>
      )}
    </div>
  );
};
