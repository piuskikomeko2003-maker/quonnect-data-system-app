import React, { useState } from 'react';
import { Question, QuestionType } from './types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Eye, ShieldAlert, Sparkles, Star } from 'lucide-react';

export interface FormPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  formName: string;
  questions: Question[];
}

export const FormPreview: React.FC<FormPreviewProps> = ({
  isOpen,
  onClose,
  formName,
  questions = []
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Skip Logic Evaluator
  const isQuestionVisible = (q: Question): boolean => {
    if (!q.skipLogic || !q.skipLogic.enabled || q.skipLogic.conditions.length === 0) {
      return true;
    }

    const { logicalOperator, conditions } = q.skipLogic;
    
    const evaluations = conditions.map(cond => {
      const answeredValue = answers[cond.fieldId] || '';
      const targetVal = cond.value.trim().toLowerCase();
      const ansVal = answeredValue.trim().toLowerCase();

      switch (cond.operator) {
        case 'is':
          return ansVal === targetVal;
        case 'is_not':
          return ansVal !== targetVal;
        case 'contains':
          return ansVal.includes(targetVal);
        case 'gt':
          return Number(ansVal) > Number(targetVal);
        case 'lt':
          return Number(ansVal) < Number(targetVal);
        default:
          return true;
      }
    });

    if (logicalOperator === 'AND') {
      return evaluations.every(val => val === true);
    } else {
      return evaluations.some(val => val === true);
    }
  };

  // Render specific inputs for question type
  const renderQuestionInput = (q: Question) => {
    const currentValue = answers[q.id] || '';

    switch (q.type) {
      case 'text':
        return (
          <input
            type="text"
            placeholder="Type answer here..."
            value={currentValue}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3 py-2 text-text-primary text-xs outline-none font-sans"
          />
        );

      case 'longText':
        return (
          <textarea
            placeholder="Type long response here..."
            value={currentValue}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            rows={3}
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3 py-2 text-text-primary text-xs outline-none font-sans resize-none"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            placeholder="Type number response..."
            value={currentValue}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3 py-2 text-text-primary text-xs outline-none font-sans"
          />
        );

      case 'dropdown':
        const options = q.options || [];
        return (
          <select
            value={currentValue}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3 py-2 text-text-primary text-xs outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8"
          >
            <option value="" className="text-text-muted">Select an option...</option>
            {options.map((opt, i) => (
              <option key={i} value={opt} className="bg-bg-elevated text-text-primary">
                {opt}
              </option>
            ))}
          </select>
        );

      case 'multipleChoice':
        return (
          <div className="flex flex-col gap-2">
            {(q.options || []).map((opt, i) => (
              <label 
                key={i} 
                className={`flex items-center gap-2.5 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                  currentValue === opt 
                    ? 'bg-green-soft border-green text-green font-semibold' 
                    : 'bg-bg-input/40 border-border-light text-text-secondary hover:text-text-primary'
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={opt}
                  checked={currentValue === opt}
                  onChange={() => handleAnswerChange(q.id, opt)}
                  className="w-4 h-4 text-green bg-bg-input border-border-light focus:ring-green cursor-pointer"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        // Simple multiple choice selection model for preview purpose
        const selected = currentValue ? currentValue.split(',') : [];
        const handleCheckChange = (opt: string) => {
          const updated = selected.includes(opt) 
            ? selected.filter(x => x !== opt) 
            : [...selected, opt];
          handleAnswerChange(q.id, updated.join(','));
        };
        return (
          <div className="flex flex-wrap gap-2">
            {(q.options || []).map((opt, i) => {
              const isChecked = selected.includes(opt);
              return (
                <label 
                  key={i} 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-green-muted text-green border-green font-semibold'
                      : 'bg-bg-input/60 border-border-light text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleCheckChange(opt)}
                    className="w-3.5 h-3.5 rounded border-border-light text-green focus:ring-green bg-bg-input cursor-pointer"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        );

      case 'yesNo':
        return (
          <div className="flex gap-2.5">
            {['Yes', 'No'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleAnswerChange(q.id, opt)}
                className={`flex-1 py-2 rounded-md font-semibold text-xs border transition-all cursor-pointer ${
                  currentValue === opt
                    ? 'bg-green text-black border-green font-bold'
                    : 'bg-bg-input text-text-secondary border-border-light hover:text-text-primary'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        );

      case 'rating':
        const ratingVal = Number(currentValue) || 0;
        return (
          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, idx) => {
              const starVal = idx + 1;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAnswerChange(q.id, String(starVal))}
                  className="cursor-pointer transition-transform active:scale-95 focus:outline-none"
                >
                  <Star 
                    className={`w-6 h-6 transition-colors ${
                      starVal <= ratingVal ? 'text-amber fill-amber' : 'text-text-muted hover:text-amber/50'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={currentValue}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3 py-2 text-text-primary text-xs outline-none font-sans"
          />
        );

      case 'phone':
        return (
          <input
            type="tel"
            placeholder="07XX XXX XXX"
            value={currentValue}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3 py-2 text-text-primary text-xs outline-none font-sans font-bold tracking-wider"
          />
        );

      default:
        return null;
    }
  };

  const visibleQuestions = questions.filter(isQuestionVisible);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-text-primary font-bold text-xs select-none">
          <Eye className="w-5 h-5 text-green" />
          <div className="text-left">
            <span>Form Preview: {formName}</span>
            <span className="block text-[10px] text-text-tertiary font-semibold mt-0.5 uppercase tracking-wide">Collector Interactive View</span>
          </div>
        </div>
      }
      maxWidth="md"
    >
      <div className="space-y-6 select-none max-h-[60vh] overflow-y-auto pr-1 py-1 text-left">
        {/* Banner */}
        <div className="bg-blue-muted border border-blue/20 text-blue rounded-md p-3.5 flex items-start gap-2.5">
          <Sparkles className="w-4.5 h-4.5 text-blue shrink-0 mt-0.5 animate-pulse" />
          <div className="text-[11px] leading-normal font-medium">
            <strong>Interactive Mode Enabled</strong>
            <span className="text-text-secondary block mt-0.5">
              Fill in mock inputs to test skip logic triggers. Questions with display rules will render dynamically based on matching logic evaluations.
            </span>
          </div>
        </div>

        {/* Questions list */}
        {questions.length === 0 ? (
          <div className="text-center py-8 text-text-tertiary border border-dashed border-border rounded-lg select-none">
            No questions defined for this form template.
          </div>
        ) : (
          <div className="space-y-5">
            {visibleQuestions.map((q, index) => (
              <div 
                key={q.id}
                className="bg-bg-elevated/20 border border-border/40 hover:border-border/60 rounded-lg p-4 space-y-2.5 transition-colors"
              >
                <div className="flex justify-between items-start gap-3">
                  <span className="block font-bold text-text-primary text-xs">
                    {index + 1}. {q.text || <span className="text-text-muted italic">Untitled Question</span>}
                    {q.required && <span className="text-red ml-1">*</span>}
                  </span>
                </div>
                {q.helpText && (
                  <span className="block text-[10px] text-text-tertiary leading-none italic select-none">
                    {q.helpText}
                  </span>
                )}
                <div className="pt-1 w-full">
                  {renderQuestionInput(q)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lock submission prompt in preview mode */}
      <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-text-tertiary select-none">
          <ShieldAlert className="w-4.5 h-4.5 text-text-tertiary" />
          <span>Read-only simulation block. Submission is locked in preview mode.</span>
        </div>
        <Button 
          variant="secondary" 
          onClick={onClose}
          className="w-full sm:w-auto font-bold text-xs"
        >
          <span>Exit Preview</span>
        </Button>
      </div>
    </Modal>
  );
};
