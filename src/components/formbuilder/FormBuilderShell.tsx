import React, { useState } from 'react';
import { Question } from './types';
import { QuestionList } from './QuestionList';
import { QuestionEditor } from './QuestionEditor';
import { FormPreview } from './FormPreview';
import { Button } from '../ui/Button';
import { Save, Eye, ArrowLeft, ClipboardList, BadgeInfo } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface FormBuilderShellProps {
  formId: string;
  formName: string;
  editionName: string;
  questions: Question[];
  onQuestionsChange: (questions: Question[]) => void;
  onSave: () => void;
  isSaving?: boolean;
  onBack?: () => void;
}

export const FormBuilderShell: React.FC<FormBuilderShellProps> = ({
  formId,
  formName,
  editionName,
  questions = [],
  onQuestionsChange,
  onSave,
  isSaving = false,
  onBack
}) => {
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    questions.length > 0 ? questions[0].id : null
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const activeQuestion = questions.find((q) => q.id === activeQuestionId);

  // Filter out the currently selected question and any subsequent questions 
  // to prevent cyclic dependency in skip logic display conditions.
  const getPreviousQuestions = (): Question[] => {
    if (!activeQuestionId) return [];
    const index = questions.findIndex(q => q.id === activeQuestionId);
    if (index <= 0) return [];
    return questions.slice(0, index);
  };

  const handleAddQuestion = () => {
    const newId = Math.random().toString(36).substring(7);
    const newQuestion: Question = {
      id: newId,
      text: 'New Question',
      type: 'text',
      required: false
    };
    onQuestionsChange([...questions, newQuestion]);
    setActiveQuestionId(newId);
  };

  const handleDeleteQuestion = (id: string) => {
    const updated = questions.filter((q) => q.id !== id);
    onQuestionsChange(updated);
    
    // Adjust active selection
    if (activeQuestionId === id) {
      setActiveQuestionId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleQuestionChange = (updatedQuestion: Question) => {
    const updated = questions.map((q) => {
      if (q.id === updatedQuestion.id) {
        return updatedQuestion;
      }
      return q;
    });
    onQuestionsChange(updated);
  };

  const handleReorderQuestions = (updatedQuestions: Question[]) => {
    onQuestionsChange(updatedQuestions);
  };

  return (
    <div className="flex flex-col h-full bg-bg border border-border rounded-lg overflow-hidden select-none text-left">
      {/* 1. Editor Topbar Area */}
      <div className="p-4 bg-bg-surface border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-1 rounded bg-bg-elevated border border-border-light text-text-secondary hover:text-text-primary cursor-pointer shrink-0"
              title="Go Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-green-muted text-green flex items-center justify-center font-bold">
              <ClipboardList className="w-4.5 h-4.5 text-green" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">{formName}</h3>
              <div className="flex items-center gap-2 mt-0.5 select-none">
                <span className="text-[10px] text-text-tertiary font-semibold uppercase">{questions.length} Fields</span>
                <span className="text-text-muted text-xs">•</span>
                <Badge variant="success" size="sm" className="font-bold">
                  {editionName}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="secondary" 
            onClick={() => setIsPreviewOpen(true)}
            size="sm"
            className="text-[11px]"
            disabled={questions.length === 0}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Form Preview</span>
          </Button>
          <Button 
            variant="primary" 
            onClick={onSave}
            disabled={isSaving}
            size="sm"
            className="text-[11px]"
          >
            <Save className="w-3.5 h-3.5 text-black" />
            <span>{isSaving ? 'Saving Form...' : 'Save Template'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Main Two-Panel Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[500px]">
        {/* Left question selector column (380px) */}
        <div className="w-full md:w-[380px] bg-bg-surface/40 border-b md:border-b-0 md:border-r border-border p-4.5 flex flex-col overflow-hidden shrink-0">
          <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-3 select-none flex items-center gap-1.5">
            <span>Question Structure</span>
            <span className="text-[9px] text-text-muted font-normal capitalize">(drag handle to reorder)</span>
          </h4>
          <QuestionList
            questions={questions}
            activeQuestionId={activeQuestionId}
            onSelectQuestion={setActiveQuestionId}
            onAddQuestion={handleAddQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onReorderQuestions={handleReorderQuestions}
          />
        </div>

        {/* Right editor details pane */}
        <div className="flex-1 bg-bg-surface/10 p-5 overflow-y-auto">
          <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-4 border-b border-border/20 pb-2.5 flex items-center gap-1.5 select-none">
            <span>Question Settings</span>
            {activeQuestion && (
              <span className="text-[8px] bg-bg-hover text-text-secondary px-2 py-0.5 rounded font-mono">
                ID: {activeQuestion.id}
              </span>
            )}
          </h4>
          <QuestionEditor
            question={activeQuestion}
            previousQuestions={getPreviousQuestions()}
            onChange={handleQuestionChange}
          />
        </div>
      </div>

      {/* Interactive Form Simulator Modal */}
      {isPreviewOpen && (
        <FormPreview
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          formName={formName}
          questions={questions}
        />
      )}
    </div>
  );
};
