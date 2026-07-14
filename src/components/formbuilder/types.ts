export type QuestionType =
  | 'text'
  | 'longText'
  | 'number'
  | 'dropdown'
  | 'multipleChoice'
  | 'checkbox'
  | 'yesNo'
  | 'rating'
  | 'date'
  | 'phone';

export interface SkipCondition {
  id: string;
  fieldId: string; // ID of the previous question
  operator: 'is' | 'is_not' | 'contains' | 'gt' | 'lt';
  value: string;
}

export interface SkipLogic {
  enabled: boolean;
  logicalOperator: 'AND' | 'OR';
  conditions: SkipCondition[];
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  helpText?: string;
  options?: string[]; // Used when type is dropdown, multipleChoice, checkbox
  skipLogic?: SkipLogic;
}

export interface FormTemplate {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'completed';
  questionCount: number;
  lastEdited: string;
  comingSoon?: boolean;
}
