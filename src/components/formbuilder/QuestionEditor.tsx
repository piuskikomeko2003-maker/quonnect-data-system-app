import React from 'react';
import { Question, QuestionType } from './types';
import { OptionEditor } from './OptionEditor';
import { SkipLogicBuilder } from './SkipLogicBuilder';
import { Textarea, Input, Select } from '../ui';
import {
  AlignLeft,
  FileText,
  Hash,
  List,
  CheckSquare,
  HelpCircle,
  ToggleLeft,
  Calendar,
  Phone,
  Star,
  Binary
} from 'lucide-react';

export interface QuestionEditorProps {
  question?: Question;
  previousQuestions: Question[];
  onChange: (updatedQuestion: Question) => void;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  previousQuestions,
  onChange
}) => {
  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-text-tertiary select-none border border-dashed border-border rounded-lg p-6 bg-bg-surface/10">
        <HelpCircle className="w-10 h-10 mb-2 opacity-50" />
        <span className="text-xs font-semibold">Select a question from the left panel to edit its parameters.</span>
      </div>
    );
  }

  const questionTypes: { value: QuestionType; label: string; icon: React.ReactNode }[] = [
    { value: 'text', label: 'Short Text', icon: <AlignLeft className="w-4 h-4" /> },
    { value: 'longText', label: 'Long Text', icon: <FileText className="w-4 h-4" /> },
    { value: 'number', label: 'Number', icon: <Hash className="w-4 h-4" /> },
    { value: 'dropdown', label: 'Dropdown', icon: <List className="w-4 h-4" /> },
    { value: 'multipleChoice', label: 'Multiple Choice', icon: <Binary className="w-4 h-4" /> },
    { value: 'checkbox', label: 'Checkbox', icon: <CheckSquare className="w-4 h-4" /> },
    { value: 'yesNo', label: 'Yes/No', icon: <ToggleLeft className="w-4 h-4" /> },
    { value: 'rating', label: 'Star Rating (1-5)', icon: <Star className="w-4 h-4" /> },
    { value: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" /> },
    { value: 'phone', label: 'Phone Number', icon: <Phone className="w-4 h-4" /> }
  ];

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as QuestionType;
    const isOptionsType = ['dropdown', 'multipleChoice', 'checkbox'].includes(newType);
    
    onChange({
      ...question,
      type: newType,
      // Initialize empty options array if changing to options type
      options: isOptionsType ? (question.options || []) : undefined
    });
  };

  const showOptionsEditor = ['dropdown', 'multipleChoice', 'checkbox'].includes(question.type);

  return (
    <div className="space-y-6 text-left select-none p-2 max-w-[680px]">
      {/* 1. Question Title/Text */}
      <Textarea
        label="Question Label"
        placeholder="Enter your question statement (e.g. Sells own products?)..."
        value={question.text}
        onChange={(e) => onChange({ ...question, text: e.target.value })}
        requiredAsterisk
        autoResize
      />

      {/* 2. Type Dropdown & Required toggle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Type Select */}
        <div>
          <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block mb-1.5">
            Question Type
          </label>
          <div className="relative flex items-center">
            {questionTypes.find(t => t.value === question.type)?.icon && (
              <span className="absolute left-3.5 text-green pointer-events-none">
                {questionTypes.find(t => t.value === question.type)?.icon}
              </span>
            )}
            <select
              value={question.type}
              onChange={handleTypeChange}
              className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md pl-10 pr-8 py-2 text-text-primary text-xs font-sans placeholder-text-muted transition-colors outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat"
            >
              {questionTypes.map((t) => (
                <option key={t.value} value={t.value} className="bg-bg-elevated text-text-primary">
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Required Switch Toggle */}
        <div className="flex flex-col justify-center">
          <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block mb-2">
            Required Response
          </span>
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={question.required} 
                onChange={(e) => onChange({ ...question, required: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-bg-input rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-text-secondary after:border-border after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-green peer-checked:after:bg-black" />
            </label>
            <span className="text-[11px] font-bold text-text-secondary">
              {question.required ? 'Respondent must answer' : 'Optional answer'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Help Text Input (Optional) */}
      <Input
        label="Helper Guideline Text (Optional)"
        placeholder="Provide guidance notes for this question (e.g. Enter whole number)..."
        value={question.helpText || ''}
        onChange={(e) => onChange({ ...question, helpText: e.target.value })}
      />

      {/* 4. Options editor (Conditional on type dropdown/multi/checkbox) */}
      {showOptionsEditor && (
        <div className="pt-2 border-t border-border/40">
          <OptionEditor
            options={question.options || []}
            onChange={(options) => onChange({ ...question, options })}
          />
        </div>
      )}

      {/* 5. Skip logic conditional displaying */}
      <div className="pt-2 border-t border-border/40">
        <SkipLogicBuilder
          currentQuestion={question}
          previousQuestions={previousQuestions}
          onChange={(skipLogic) => onChange({ ...question, skipLogic })}
        />
      </div>
    </div>
  );
};
