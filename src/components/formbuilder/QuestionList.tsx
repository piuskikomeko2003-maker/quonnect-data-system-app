import React from 'react';
import { Question, QuestionType } from './types';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, 
  Trash2, 
  AlignLeft, 
  FileText, 
  Hash, 
  List, 
  CheckSquare, 
  ToggleLeft, 
  Calendar, 
  Phone, 
  Star, 
  Binary,
  Plus,
  GitFork
} from 'lucide-react';
import { Button } from '../ui/Button';

// Icon mapper for question type
export const getQuestionTypeIcon = (type: QuestionType) => {
  const size = "w-3.5 h-3.5";
  switch (type) {
    case 'text': return <AlignLeft className={size} />;
    case 'longText': return <FileText className={size} />;
    case 'number': return <Hash className={size} />;
    case 'dropdown': return <List className={size} />;
    case 'multipleChoice': return <Binary className={size} />;
    case 'checkbox': return <CheckSquare className={size} />;
    case 'yesNo': return <ToggleLeft className={size} />;
    case 'rating': return <Star className={size} />;
    case 'date': return <Calendar className={size} />;
    case 'phone': return <Phone className={size} />;
    default: return <AlignLeft className={size} />;
  }
};

// Sortable item wrapper using useSortable hook
interface SortableItemProps {
  question: Question;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
  question,
  isActive,
  onSelect,
  onDelete
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 200 : 'auto',
  };

  const hasSkipLogic = question.skipLogic?.enabled && question.skipLogic.conditions.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group flex items-center gap-2.5 p-3 rounded-md border text-left cursor-pointer transition-all ${
        isActive 
          ? 'bg-green-soft border-green text-green' 
          : 'bg-bg-input/80 border-border-light text-text-primary hover:bg-bg-hover hover:border-border'
      }`}
    >
      {/* Drag handle */}
      <div 
        {...attributes} 
        {...listeners} 
        className="text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing p-0.5 shrink-0"
        onClick={(e) => e.stopPropagation()} // Prevent select trigger
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Question type icon */}
      <div className={`p-1.5 rounded shrink-0 ${isActive ? 'bg-green/15 text-green' : 'bg-bg-surface text-text-secondary'}`}>
        {getQuestionTypeIcon(question.type)}
      </div>

      {/* Question details */}
      <div className="flex-1 min-w-0 pr-2">
        <span className="block text-xs font-bold truncate">
          {question.text || <span className="text-text-muted italic">Untitled Question</span>}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5 select-none">
          <span className="text-[9px] text-text-tertiary font-semibold uppercase">
            {question.type.replace(/([A-Z])/g, ' $1')}
          </span>
          {question.required && (
            <span className="text-[8px] bg-red-muted text-red px-1 rounded-sm uppercase font-bold shrink-0">
              required
            </span>
          )}
          {hasSkipLogic && (
            <span className="text-[8px] bg-blue-muted text-blue px-1 rounded-sm uppercase font-bold shrink-0 flex items-center gap-0.5" title="Branch active">
              <GitFork className="w-2.5 h-2.5" />
              <span>Logic</span>
            </span>
          )}
        </div>
      </div>

      {/* Delete trigger - visible on list item hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // Prevent select trigger
          onDelete();
        }}
        className="p-1 rounded hover:bg-red-500/10 hover:text-red transition-all cursor-pointer shrink-0 text-gray-500"
        title="Delete Question"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export interface QuestionListProps {
  questions: Question[];
  activeQuestionId: string | null;
  onSelectQuestion: (id: string) => void;
  onAddQuestion: () => void;
  onDeleteQuestion: (id: string) => void;
  onReorderQuestions: (updatedQuestions: Question[]) => void;
}

export const QuestionList: React.FC<QuestionListProps> = ({
  questions = [],
  activeQuestionId,
  onSelectQuestion,
  onAddQuestion,
  onDeleteQuestion,
  onReorderQuestions
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex(q => q.id === active.id);
      const newIndex = questions.findIndex(q => q.id === over.id);
      onReorderQuestions(arrayMove(questions, oldIndex, newIndex));
    }
  };

  return (
    <div className="flex flex-col h-full select-none text-left">
      {/* Scrollable Questions list container */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 mb-4">
        {questions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg text-text-tertiary select-none">
            <p className="text-xs font-semibold">No questions added yet.</p>
            <p className="text-[10px] text-text-muted mt-1">Click the button below to start building.</p>
          </div>
        ) : (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={questions.map(q => q.id)}
              strategy={verticalListSortingStrategy}
            >
              {questions.map((question) => (
                <SortableItem
                  key={question.id}
                  question={question}
                  isActive={activeQuestionId === question.id}
                  onSelect={() => onSelectQuestion(question.id)}
                  onDelete={() => onDeleteQuestion(question.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add question button */}
      <Button
        variant="secondary"
        onClick={onAddQuestion}
        className="w-full border-green text-green hover:bg-green-soft py-2 text-xs cursor-pointer select-none font-bold"
      >
        <Plus className="w-4 h-4 text-green" />
        <span>Add Question</span>
      </Button>
    </div>
  );
};
