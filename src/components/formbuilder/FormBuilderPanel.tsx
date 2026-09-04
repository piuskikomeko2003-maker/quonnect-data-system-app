'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  FolderPlus, 
  BookOpen, 
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Edit2,
  Check,
  FolderOpen,
  HelpCircle,
  Sliders,
  Sparkles,
  GitCommit,
  Eye,
  RotateCcw,
  Compass,
  Camera
} from 'lucide-react';

interface Form {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
}

interface FormSection {
  id: string;
  form_id: string;
  name: string;
  description: string;
  sort_order: number;
}

interface SurveyQuestion {
  id: string;
  form_id: string;
  section_id: string;
  question_text: string;
  question_type: string;
  is_required: boolean;
  sort_order: number;
  csv_column: string;
  options: string[] | null;
}

interface QuestionLogic {
  id: string;
  source_question_id: string;
  operator: string;
  comparison_value: string;
  action: string;
  target_question_id: string;
  sort_order: number;
}

interface SectionLogic {
  id: string;
  source_question_id: string;
  operator: string;
  comparison_value: string;
  action: string;
  target_section_id: string;
  sort_order: number;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

const QUESTION_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes/No Toggle' },
  { value: 'select', label: 'Single Choice Dropdown' },
  { value: 'multi_select', label: 'Multiple Choice Checkboxes' },
  { value: 'date', label: 'Date Picker' },
  { value: 'time', label: 'Time Picker' },
  { value: 'gps', label: 'GPS Coordinates' },
  { value: 'photo', label: 'Photo Upload' },
  { value: 'note', label: 'Display-only Note' }
];

const LOGIC_OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'gt', label: 'is greater than' },
  { value: 'lt', label: 'is less than' }
];

export const FormBuilderPanel: React.FC = () => {
  const [forms, setForms] = useState<Form[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formQuestionCounts, setFormQuestionCounts] = useState<Record<string, number>>({});
  
  // Create Form Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isSavingForm, setIsSavingForm] = useState(false);

  // Section management states
  const [sections, setSections] = useState<FormSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionDescription, setNewSectionDescription] = useState('');
  const [isSavingSection, setIsSavingSection] = useState(false);
  
  // Inline editing of sections
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionName, setEditSectionName] = useState('');
  const [editSectionDesc, setEditSectionDesc] = useState('');
  const [isUpdatingSection, setIsUpdatingSection] = useState(false);

  // Question management states
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  
  // Add/Edit Question Panel states
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null); // null = adding, string = editing
  const [questionTargetSectionId, setQuestionTargetSectionId] = useState('');
  
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState('text');
  const [isRequired, setIsRequired] = useState(false);
  const [csvColumn, setCsvColumn] = useState('');
  const [questionOptions, setQuestionOptions] = useState<string[]>([]);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  // Skip Logic states
  const [questionRules, setQuestionRules] = useState<QuestionLogic[]>([]);
  const [sectionRules, setSectionRules] = useState<SectionLogic[]>([]);
  const [isLogicModalOpen, setIsLogicModalOpen] = useState(false);
  const [logicSourceQuestion, setLogicSourceQuestion] = useState<SurveyQuestion | null>(null);
  
  // New skip rule builder states
  const [logicAction, setLogicAction] = useState('show');
  const [logicTargetType, setLogicTargetType] = useState('question'); // 'question' | 'section'
  const [logicTargetId, setLogicTargetId] = useState('');
  const [logicOperator, setLogicOperator] = useState('eq');
  const [logicValue, setLogicValue] = useState('');
  const [isSavingLogic, setIsSavingLogic] = useState(false);

  // Form Preview states
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});

  // Toast notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchForms = async () => {
    setLoadingForms(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        addToast("Supabase client not initialized.", "error");
        return;
      }
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setForms(data || []);

      if (data && data.length > 0) {
        const formIds = data.map((f: Form) => f.id);
        const { data: qData, error: qError } = await supabase
          .from('survey_questions')
          .select('form_id')
          .in('form_id', formIds);

        if (!qError && qData) {
          const counts: Record<string, number> = {};
          qData.forEach((q: any) => {
            counts[q.form_id] = (counts[q.form_id] || 0) + 1;
          });
          setFormQuestionCounts(counts);
        }
      }
    } catch (err: any) {
      console.error("Error fetching forms:", err);
      addToast(err.message || "Failed to load forms.", "error");
    } finally {
      setLoadingForms(false);
    }
  };

  const fetchSections = async (formId: string) => {
    setLoadingSections(true);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data, error } = await supabase
        .from('form_sections')
        .select('*')
        .eq('form_id', formId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSections(data || []);
    } catch (err: any) {
      console.error("Error fetching sections:", err);
      addToast(err.message || "Failed to load sections.", "error");
    } finally {
      setLoadingSections(false);
    }
  };

  const fetchQuestions = async (formId: string) => {
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data, error } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('form_id', formId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setQuestions(data || []);
      setFormQuestionCounts(prev => ({ ...prev, [formId]: (data || []).length }));
      
      // Also fetch logic rules using helper
      if (data && data.length > 0) {
        fetchLogic(data.map((q: any) => q.id));
      } else {
        setQuestionRules([]);
        setSectionRules([]);
      }
    } catch (err: any) {
      console.error("Error fetching questions:", err);
      addToast(err.message || "Failed to load questions.", "error");
    }
  };

  const fetchLogic = async (questionIds: string[]) => {
    if (questionIds.length === 0) {
      setQuestionRules([]);
      setSectionRules([]);
      return;
    }
    try {
      const supabase = createClient();
      if (!supabase) return;

      const { data: qData, error: qErr } = await supabase
        .from('question_logic')
        .select('*')
        .in('source_question_id', questionIds);

      if (qErr) throw qErr;

      const { data: sData, error: sErr } = await supabase
        .from('section_logic')
        .select('*')
        .in('source_question_id', questionIds);

      if (sErr) throw sErr;

      setQuestionRules(qData || []);
      setSectionRules(sData || []);
    } catch (err: any) {
      console.error("Error fetching logic rules:", err);
      addToast(err.message || "Failed to load skip logic rules.", "error");
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetSlug = customEvent.detail?.formSlug;
      if (targetSlug && forms.length > 0) {
        const targetForm = forms.find(f => f.slug === targetSlug);
        if (targetForm) {
          setSelectedFormId(targetForm.id);
        }
      }
    };
    window.addEventListener('select-form-in-builder', handler);
    return () => window.removeEventListener('select-form-in-builder', handler);
  }, [forms]);

  useEffect(() => {
    if (selectedFormId) {
      fetchSections(selectedFormId);
      fetchQuestions(selectedFormId);
      setIsAddSectionOpen(false);
      setEditingSectionId(null);
      setIsQuestionModalOpen(false);
      setEditingQuestionId(null);
      setIsLogicModalOpen(false);
      setLogicSourceQuestion(null);
      setIsPreviewOpen(false);
      setPreviewAnswers({});
    } else {
      setSections([]);
      setQuestions([]);
      setQuestionRules([]);
      setSectionRules([]);
    }
  }, [selectedFormId]);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
      .replace(/\s+/g, '-')       // collapse whitespace and replace by -
      .replace(/-+/g, '-');       // collapse dashes
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormName(name);
    setFormSlug(slugify(name));
  };

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      addToast("Name and slug are required.", "error");
      return;
    }

    // Validate unique slug client-side
    const slugExists = forms.some(f => f.slug === formSlug);
    if (slugExists) {
      addToast("A form with this slug already exists.", "error");
      return;
    }

    setIsSavingForm(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { data, error } = await supabase
        .from('forms')
        .insert([{
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim()
        }])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error.message, error.code, error.details);
        throw error;
      }

      addToast("Form created successfully!", "success");
      setFormName('');
      setFormSlug('');
      setFormDescription('');
      setIsCreateModalOpen(false);
      
      // Refresh list and select the new form if successfully inserted
      await fetchForms();
      if (data) {
        setSelectedFormId(data.id);
      }
    } catch (err: any) {
      console.error("Error creating form:", err?.message, err?.code, err?.details, JSON.stringify(err));
      addToast(err.message || "Failed to create form.", "error");
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleDeleteForm = async (id: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete the form "${name}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', id);

      if (error) throw error;

      addToast(`Form "${name}" deleted.`, "success");
      if (selectedFormId === id) {
        setSelectedFormId(null);
      }
      fetchForms();
    } catch (err: any) {
      console.error("Error deleting form:", err);
      addToast(err.message || "Failed to delete form.", "error");
    }
  };

  // Section Management Functions
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFormId) return;
    if (!newSectionName.trim()) {
      addToast("Section name is required.", "error");
      return;
    }

    setIsSavingSection(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      // Calculate next sort_order
      const nextSortOrder = sections.length > 0 
        ? Math.max(...sections.map(s => s.sort_order)) + 1 
        : 1;

      const { error } = await supabase
        .from('form_sections')
        .insert([{
          form_id: selectedFormId,
          name: newSectionName.trim(),
          description: newSectionDescription.trim(),
          sort_order: nextSortOrder
        }]);

      if (error) throw error;

      addToast("Section added successfully!", "success");
      setNewSectionName('');
      setNewSectionDescription('');
      setIsAddSectionOpen(false);
      fetchSections(selectedFormId);
    } catch (err: any) {
      console.error("Error adding section:", err);
      addToast(err.message || "Failed to add section.", "error");
    } finally {
      setIsSavingSection(false);
    }
  };

  const handleStartEditSection = (section: FormSection) => {
    setEditingSectionId(section.id);
    setEditSectionName(section.name);
    setEditSectionDesc(section.description || '');
  };

  const handleUpdateSection = async (sectionId: string) => {
    if (!editSectionName.trim()) {
      addToast("Section name cannot be empty.", "error");
      return;
    }

    setIsUpdatingSection(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('form_sections')
        .update({
          name: editSectionName.trim(),
          description: editSectionDesc.trim()
        })
        .eq('id', sectionId);

      if (error) throw error;

      addToast("Section updated successfully!", "success");
      setEditingSectionId(null);
      if (selectedFormId) fetchSections(selectedFormId);
    } catch (err: any) {
      console.error("Error updating section:", err);
      addToast(err.message || "Failed to update section.", "error");
    } finally {
      setIsUpdatingSection(false);
    }
  };

  const handleDeleteSection = async (sectionId: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete section "${name}" and all of its questions?`);
    if (!confirmed) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('form_sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;

      addToast(`Section "${name}" deleted.`, "success");
      if (selectedFormId) {
        fetchSections(selectedFormId);
        fetchQuestions(selectedFormId);
      }
    } catch (err: any) {
      console.error("Error deleting section:", err);
      addToast(err.message || "Failed to delete section.", "error");
    }
  };

  const handleReorderSection = async (index: number, direction: 'up' | 'down') => {
    if (!selectedFormId) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const currentSection = sections[index];
    const targetSection = sections[targetIndex];

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      // Swap sort_order values
      const currentSort = currentSection.sort_order;
      const targetSort = targetSection.sort_order;

      // Update target section first, then current section
      const { error: targetErr } = await supabase
        .from('form_sections')
        .update({ sort_order: currentSort })
        .eq('id', targetSection.id);

      if (targetErr) throw targetErr;

      const { error: currentErr } = await supabase
        .from('form_sections')
        .update({ sort_order: targetSort })
        .eq('id', currentSection.id);

      if (currentErr) throw currentErr;

      addToast("Sections reordered successfully.", "success");
      fetchSections(selectedFormId);
    } catch (err: any) {
      console.error("Error reordering section:", err);
      addToast(err.message || "Failed to reorder sections.", "error");
    }
  };

  // Question Management Functions
  const handleOpenAddQuestion = (sectionId: string) => {
    setEditingQuestionId(null);
    setQuestionTargetSectionId(sectionId);
    setQuestionText('');
    setQuestionType('text');
    setIsRequired(false);
    setCsvColumn('');
    setQuestionOptions([]);
    setIsQuestionModalOpen(true);
  };

  const handleOpenEditQuestion = (question: SurveyQuestion) => {
    setEditingQuestionId(question.id);
    setQuestionTargetSectionId(question.section_id);
    setQuestionText(question.question_text);
    setQuestionType(question.question_type);
    setIsRequired(question.is_required);
    setCsvColumn(question.csv_column);
    setQuestionOptions(question.options || []);
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFormId || !questionTargetSectionId) return;
    if (!questionText.trim()) {
      addToast("Question text is required.", "error");
      return;
    }
    if (!csvColumn.trim()) {
      addToast("CSV export column mapping is required.", "error");
      return;
    }

    // Validate CSV Column is unique within the form
    const isCsvDuplicate = questions.some(
      q => q.id !== editingQuestionId && q.csv_column.toLowerCase().trim() === csvColumn.toLowerCase().trim()
    );
    if (isCsvDuplicate) {
      addToast(`CSV export column "${csvColumn}" is already used in this form. It must be unique.`, "error");
      return;
    }

    // Options mapping check
    const isSelectType = ['select', 'multi_select'].includes(questionType);
    const cleanedOptions = isSelectType ? questionOptions.filter(o => o.trim() !== '') : null;
    if (isSelectType && (!cleanedOptions || cleanedOptions.length === 0)) {
      addToast("Please provide at least one answer option.", "error");
      return;
    }

    setIsSavingQuestion(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      if (editingQuestionId) {
        // Edit existing question
        const { error } = await supabase
          .from('survey_questions')
          .update({
            question_text: questionText.trim(),
            question_type: questionType,
            is_required: isRequired,
            csv_column: csvColumn.trim(),
            options: cleanedOptions
          })
          .eq('id', editingQuestionId);

        if (error) throw error;
        addToast("Question updated successfully!", "success");
      } else {
        // Add new question
        const sectionQuestions = questions.filter(q => q.section_id === questionTargetSectionId);
        const nextSortOrder = sectionQuestions.length > 0
          ? Math.max(...sectionQuestions.map(q => q.sort_order)) + 1
          : 1;

        const { error } = await supabase
          .from('survey_questions')
          .insert([{
            form_id: selectedFormId,
            section_id: questionTargetSectionId,
            question_text: questionText.trim(),
            question_type: questionType,
            is_required: isRequired,
            csv_column: csvColumn.trim(),
            options: cleanedOptions,
            sort_order: nextSortOrder
          }]);

        if (error) throw error;
        addToast("Question added successfully!", "success");
      }

      setIsQuestionModalOpen(false);
      fetchQuestions(selectedFormId);
    } catch (err: any) {
      console.error("Error saving question:", err);
      addToast(err.message || "Failed to save question.", "error");
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string, text: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete the question: "${text}"?`);
    if (!confirmed) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('survey_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      addToast("Question deleted.", "success");
      if (selectedFormId) fetchQuestions(selectedFormId);
    } catch (err: any) {
      console.error("Error deleting question:", err);
      addToast(err.message || "Failed to delete question.", "error");
    }
  };

  const handleReorderQuestion = async (sectionId: string, index: number, direction: 'up' | 'down') => {
    if (!selectedFormId) return;
    const sectionQuestions = questions
      .filter(q => q.section_id === sectionId)
      .sort((a, b) => a.sort_order - b.sort_order);

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sectionQuestions.length) return;

    const currentQuestion = sectionQuestions[index];
    const targetQuestion = sectionQuestions[targetIndex];

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      // Swap sort_orders
      const currentSort = currentQuestion.sort_order;
      const targetSort = targetQuestion.sort_order;

      const { error: targetErr } = await supabase
        .from('survey_questions')
        .update({ sort_order: currentSort })
        .eq('id', targetQuestion.id);

      if (targetErr) throw targetErr;

      const { error: currentErr } = await supabase
        .from('survey_questions')
        .update({ sort_order: targetSort })
        .eq('id', currentQuestion.id);

      if (currentErr) throw currentErr;

      addToast("Questions reordered successfully.", "success");
      fetchQuestions(selectedFormId);
    } catch (err: any) {
      console.error("Error reordering question:", err);
      addToast(err.message || "Failed to reorder questions.", "error");
    }
  };

  const handleAddOption = () => {
    setQuestionOptions([...questionOptions, `Option ${questionOptions.length + 1}`]);
  };

  const handleRemoveOption = (index: number) => {
    setQuestionOptions(questionOptions.filter((_, idx) => idx !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = questionOptions.map((item, idx) => idx === index ? val : item);
    setQuestionOptions(updated);
  };

  // Skip Logic functions
  const handleOpenSkipLogic = (question: SurveyQuestion) => {
    setLogicSourceQuestion(question);
    setLogicAction('show');
    setLogicTargetType('question');
    setLogicOperator('eq');
    setLogicValue('');
    
    // Set initial target to the first available target depending on target type
    const possibleTargets = questions.filter(q => q.id !== question.id);
    if (possibleTargets.length > 0) {
      setLogicTargetId(possibleTargets[0].id);
    } else {
      setLogicTargetId('');
    }
    
    setIsLogicModalOpen(true);
  };

  const handleSaveSkipRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFormId || !logicSourceQuestion || !logicTargetId) {
      addToast("Required skip logic fields are missing.", "error");
      return;
    }

    setIsSavingLogic(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      if (logicTargetType === 'question') {
        const existingRules = questionRules.filter(r => r.source_question_id === logicSourceQuestion.id);
        const nextSort = existingRules.length > 0
          ? Math.max(...existingRules.map(r => r.sort_order)) + 1
          : 1;

        const { error } = await supabase
          .from('question_logic')
          .insert([{
            source_question_id: logicSourceQuestion.id,
            target_question_id: logicTargetId,
            action: logicAction,
            operator: logicOperator,
            comparison_value: logicValue.trim(),
            sort_order: nextSort
          }]);

        if (error) throw error;
      } else {
        const existingRules = sectionRules.filter(r => r.source_question_id === logicSourceQuestion.id);
        const nextSort = existingRules.length > 0
          ? Math.max(...existingRules.map(r => r.sort_order)) + 1
          : 1;

        const { error } = await supabase
          .from('section_logic')
          .insert([{
            source_question_id: logicSourceQuestion.id,
            target_section_id: logicTargetId,
            action: logicAction,
            operator: logicOperator,
            comparison_value: logicValue.trim(),
            sort_order: nextSort
          }]);

        if (error) throw error;
      }

      addToast("Skip logic rule added successfully!", "success");
      setLogicValue('');
      fetchQuestions(selectedFormId);
    } catch (err: any) {
      console.error("Error saving skip logic rule:", err);
      addToast(err.message || "Failed to save skip logic rule.", "error");
    } finally {
      setIsSavingLogic(false);
    }
  };

  const handleDeleteQuestionRule = async (ruleId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this question logic rule?");
    if (!confirmed) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('question_logic')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      addToast("Skip logic rule deleted.", "success");
      if (selectedFormId) fetchQuestions(selectedFormId);
    } catch (err: any) {
      console.error("Error deleting rule:", err);
      addToast(err.message || "Failed to delete skip rule.", "error");
    }
  };

  const handleDeleteSectionRule = async (ruleId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this section logic rule?");
    if (!confirmed) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('section_logic')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      addToast("Skip logic rule deleted.", "success");
      if (selectedFormId) fetchQuestions(selectedFormId);
    } catch (err: any) {
      console.error("Error deleting rule:", err);
      addToast(err.message || "Failed to delete skip rule.", "error");
    }
  };

  const getRuleDescription = (rule: any, isSectionTarget: boolean) => {
    const actionText = rule.action === 'show' ? 'Show' : 'Hide';
    const operatorLabel = LOGIC_OPERATORS.find(op => op.value === rule.operator)?.label || rule.operator;
    
    if (isSectionTarget) {
      const targetSec = sections.find(s => s.id === rule.target_section_id);
      return `${actionText} section "${targetSec?.name || 'Unknown'}" when value ${operatorLabel} "${rule.comparison_value}"`;
    } else {
      const targetQ = questions.find(q => q.id === rule.target_question_id);
      return `${actionText} question "${targetQ?.question_text || 'Unknown'}" when value ${operatorLabel} "${rule.comparison_value}"`;
    }
  };

  // Form Preview Simulator Evaluation Logic
  const checkRuleCondition = (sourceQId: string, operator: string, compVal: string) => {
    const rawAnswer = previewAnswers[sourceQId];
    const answer = rawAnswer !== undefined && rawAnswer !== null ? String(rawAnswer) : '';
    
    const cleanAnswer = answer.toString().toLowerCase().trim();
    const cleanCompVal = compVal.toString().toLowerCase().trim();

    switch (operator) {
      case 'eq':
        return cleanAnswer === cleanCompVal;
      case 'neq':
        return cleanAnswer !== cleanCompVal;
      case 'gt':
        return Number(answer) > Number(compVal);
      case 'lt':
        return Number(answer) < Number(compVal);
      default:
        return false;
    }
  };

  const isSectionVisible = (sectionId: string) => {
    const rules = sectionRules.filter(r => r.target_section_id === sectionId);
    if (rules.length === 0) return true;

    const showRules = rules.filter(r => r.action === 'show');
    const hideRules = rules.filter(r => r.action === 'hide');

    // If any hide rule evaluates to true, section is hidden
    const anyHideTriggered = hideRules.some(r => checkRuleCondition(r.source_question_id, r.operator, r.comparison_value));
    if (anyHideTriggered) return false;

    // If there are show rules, at least one must evaluate to true, otherwise default to hidden
    if (showRules.length > 0) {
      const anyShowTriggered = showRules.some(r => checkRuleCondition(r.source_question_id, r.operator, r.comparison_value));
      return anyShowTriggered;
    }

    return true;
  };

  const isQuestionVisible = (q: SurveyQuestion) => {
    // 1. Check parent section visibility first
    if (!isSectionVisible(q.section_id)) return false;

    // 2. Check question logic rules
    const rules = questionRules.filter(r => r.target_question_id === q.id);
    if (rules.length === 0) return true;

    const showRules = rules.filter(r => r.action === 'show');
    const hideRules = rules.filter(r => r.action === 'hide');

    // If any hide rule is met, it is hidden
    const anyHideTriggered = hideRules.some(r => checkRuleCondition(r.source_question_id, r.operator, r.comparison_value));
    if (anyHideTriggered) return false;

    // If show rules exist, at least one must be met, otherwise default is hidden
    if (showRules.length > 0) {
      const anyShowTriggered = showRules.some(r => checkRuleCondition(r.source_question_id, r.operator, r.comparison_value));
      return anyShowTriggered;
    }

    return true;
  };

  const handlePreviewAnswerChange = (qId: string, val: any) => {
    setPreviewAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handlePreviewMultiSelectChange = (qId: string, option: string, checked: boolean) => {
    const currentList = previewAnswers[qId] || [];
    let updated;
    if (checked) {
      updated = [...currentList, option];
    } else {
      updated = currentList.filter((item: string) => item !== option);
    }
    setPreviewAnswers(prev => ({ ...prev, [qId]: updated }));
  };

  const handleResetPreview = () => {
    setPreviewAnswers({});
  };

  const selectedForm = forms.find(f => f.id === selectedFormId);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[750px] bg-[#0f1117] border border-white/5 rounded-xl overflow-hidden select-none text-left relative">
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 p-3.5 rounded-lg shadow-lg text-xs font-semibold text-white animate-slide-up pointer-events-auto border ${
              toast.type === 'success' 
                ? 'bg-green-500/90 border-green-400 text-white' 
                : 'bg-red-500/90 border-red-400 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button 
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-gray-300 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Form Builder Section */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Forms List (320px) */}
        <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r border-white/5 bg-white/[0.01] p-4.5 flex flex-col overflow-hidden shrink-0">
          <div className="flex justify-between items-center mb-4 select-none shrink-0">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-green-400" />
              <span>Surveys Forms</span>
            </h3>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-2.5 bg-green-500 hover:bg-green-600 text-black font-semibold"
            >
              <Plus className="w-3.5 h-3.5 text-black mr-1" />
              <span>New Form</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingForms ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-green-400" />
                <span className="text-[10px]">Loading forms...</span>
              </div>
            ) : forms.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-white/10 rounded-xl">
                <BookOpen className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-bold text-gray-300">No forms found</p>
                <p className="text-[10px] text-gray-500 mt-1">Create your first database form to begin.</p>
              </div>
            ) : (
              forms.map((form) => {
                const isActive = form.id === selectedFormId;
                const qCount = formQuestionCounts[form.id] || 0;
                return (
                  <div
                    key={form.id}
                    onClick={() => setSelectedFormId(form.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${
                      isActive 
                        ? 'bg-green-500/10 border-green-500/50' 
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <span className={`block font-bold text-xs truncate ${isActive ? 'text-green-400' : 'text-white'}`}>
                        {form.name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="block text-[10px] text-gray-500 font-mono truncate">
                          /{form.slug}
                        </span>
                        <span className="inline-block bg-white/5 border border-white/10 text-gray-300 font-mono text-[9px] px-1.5 py-0.2 rounded shrink-0">
                          {qCount} {qCount === 1 ? 'question' : 'questions'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteForm(form.id, form.name);
                        }}
                        className="p-1 rounded bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 cursor-pointer"
                        title="Delete Form"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-green-400' : 'text-gray-500'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Editor Panel */}
        <div className="flex-1 bg-transparent overflow-hidden flex flex-col">
          {selectedFormId && selectedForm ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Form Editor Header */}
              <div className="p-4 border-b border-white/5 bg-[#0f1117] flex items-center justify-between shrink-0 select-none">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">{selectedForm.name}</h2>
                  <p className="text-[10px] text-gray-400 mt-0.5">{selectedForm.description || "No description provided."}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsPreviewOpen(true)}
                    className="text-[11px] bg-white/5 border border-white/10 text-white hover:bg-white/10"
                    disabled={questions.length === 0}
                  >
                    <Eye className="w-3.5 h-3.5 text-gray-400 mr-1" />
                    <span>Preview Form</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsAddSectionOpen(!isAddSectionOpen)}
                    className="text-[11px] bg-white/5 border border-white/10 text-white hover:bg-white/10"
                  >
                    <Plus className="w-3.5 h-3.5 text-text-secondary mr-1" />
                    <span>Add Section</span>
                  </Button>
                </div>
              </div>

              {/* Add Section inline box */}
              {isAddSectionOpen && (
                <form onSubmit={handleAddSection} className="p-4 bg-bg-elevated border-b border-border/80 space-y-3.5 select-none animate-slide-down shrink-0">
                  <div className="flex justify-between items-center border-b border-border/30 pb-2">
                    <h4 className="text-[10px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <FolderOpen className="w-4 h-4 text-green" />
                      <span>New Section Details</span>
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => setIsAddSectionOpen(false)}
                      className="text-text-secondary hover:text-text-primary cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Section Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. Identity & Demographics"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        className="w-full bg-bg-input border border-border-light rounded-md px-3 py-1.5 text-xs text-text-primary outline-none focus:border-green"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Description</label>
                      <input 
                        type="text"
                        placeholder="e.g. Basic demographics of field responder"
                        value={newSectionDescription}
                        onChange={(e) => setNewSectionDescription(e.target.value)}
                        className="w-full bg-bg-input border border-border-light rounded-md px-3 py-1.5 text-xs text-text-primary outline-none focus:border-green"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => setIsAddSectionOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      variant="primary" 
                      size="sm"
                      disabled={isSavingSection}
                    >
                      {isSavingSection ? 'Adding...' : 'Add Section'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Editor body: list of sections */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {loadingSections ? (
                  <div className="flex flex-col items-center justify-center py-20 text-text-tertiary gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-green" />
                    <span className="text-xs">Loading form sections...</span>
                  </div>
                ) : sections.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-border rounded-xl">
                    <FolderOpen className="w-12 h-12 text-green/60 mx-auto mb-3" />
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">No Sections Found</h3>
                    <p className="text-[10px] text-text-secondary max-w-xs mx-auto mt-1 leading-relaxed">
                      Click the "Add Section" button in the top right to create the first section for this form.
                    </p>
                  </div>
                ) : (
                  sections.map((section, sectionIdx) => {
                    const isEditing = editingSectionId === section.id;
                    const sectionQuestions = questions
                      .filter(q => q.section_id === section.id)
                      .sort((a, b) => a.sort_order - b.sort_order);

                    return (
                      <div key={section.id} className="bg-bg-elevated/45 border border-border/80 rounded-xl overflow-hidden shadow-sm transition-all duration-200 text-xs">
                        {/* Section Header */}
                        <div className="p-4 bg-bg-surface border-b border-border/60 flex items-center justify-between gap-4">
                          {isEditing ? (
                            <div className="flex-1 flex flex-col gap-2">
                              <input 
                                type="text"
                                value={editSectionName}
                                onChange={(e) => setEditSectionName(e.target.value)}
                                className="w-full bg-bg-input border border-border-light rounded px-2.5 py-1 text-xs font-bold text-text-primary outline-none focus:border-green"
                                placeholder="Section Name"
                              />
                              <input 
                                type="text"
                                value={editSectionDesc}
                                onChange={(e) => setEditSectionDesc(e.target.value)}
                                className="w-full bg-bg-input border border-border-light rounded px-2.5 py-1 text-[10px] text-text-secondary outline-none focus:border-green"
                                placeholder="Section Description"
                              />
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider truncate">
                                  {section.name}
                                </h3>
                                <Badge variant="info" size="sm" className="font-mono text-[9px] px-1.5">
                                  Section {sectionIdx + 1}
                                </Badge>
                              </div>
                              {section.description && (
                                <p className="text-[10px] text-text-secondary mt-0.5 truncate">
                                  {section.description}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleUpdateSection(section.id)}
                                  disabled={isUpdatingSection}
                                  className="p-1 rounded bg-green/10 border border-green/30 text-green hover:bg-green/20 cursor-pointer"
                                  title="Save Changes"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingSectionId(null)}
                                  className="p-1 rounded bg-bg-elevated border border-border-light text-text-secondary hover:text-text-primary cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleReorderSection(sectionIdx, 'up')}
                                  disabled={sectionIdx === 0}
                                  className={`p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer ${sectionIdx === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                                  title="Move Section Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleReorderSection(sectionIdx, 'down')}
                                  disabled={sectionIdx === sections.length - 1}
                                  className={`p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer ${sectionIdx === sections.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                                  title="Move Section Down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleStartEditSection(section)}
                                  className="p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer"
                                  title="Edit Section"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSection(section.id, section.name)}
                                  className="p-1 rounded border border-border-light bg-bg-elevated hover:bg-red-soft/20 text-text-secondary hover:text-red cursor-pointer"
                                  title="Delete Section"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleOpenAddQuestion(section.id)}
                                  className="text-[10px] px-2 py-1 font-semibold"
                                >
                                  <Plus className="w-3 h-3 text-white mr-1" />
                                  <span>Add Question</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Questions list inside the section */}
                        <div className="bg-bg-surface/10 divide-y divide-border/30">
                          {sectionQuestions.length === 0 ? (
                            <div className="p-5 text-center text-[10px] text-text-tertiary select-none">
                              No questions in this section yet. Click "+ Add Question" to get started.
                            </div>
                          ) : (
                            sectionQuestions.map((q, qIdx) => {
                              const qLogicRules = questionRules.filter(r => r.source_question_id === q.id);
                              const sLogicRules = sectionRules.filter(r => r.source_question_id === q.id);
                              const totalRules = qLogicRules.length + sLogicRules.length;

                              return (
                                <div 
                                  key={q.id} 
                                  onClick={() => handleOpenEditQuestion(q)}
                                  className="p-3.5 hover:bg-bg-elevated/25 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                                >
                                  <div className="min-w-0 flex-1 flex items-start gap-3">
                                    <div className="w-5 h-5 rounded bg-bg-hover text-text-secondary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                      {qIdx + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center flex-wrap gap-2">
                                        <span className="font-bold text-text-primary leading-normal">
                                          {q.question_text}
                                          {q.is_required && <span className="text-red ml-0.5 font-normal">*</span>}
                                        </span>
                                        <Badge variant="info" className="font-mono text-[9px] lowercase px-1.5 py-0">
                                          {q.question_type}
                                        </Badge>
                                        {totalRules > 0 && (
                                          <Badge variant="success" className="font-mono text-[9px] px-1.5 py-0 flex items-center gap-1">
                                            <Sliders className="w-2.5 h-2.5" />
                                            <span>{totalRules} logic {totalRules === 1 ? 'rule' : 'rules'}</span>
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 mt-1.5 select-none text-[9px] text-text-tertiary">
                                        <span className="font-mono font-semibold bg-bg-hover px-1.5 py-0.5 rounded text-green">
                                          csv: {q.csv_column}
                                        </span>
                                        {q.options && q.options.length > 0 && (
                                          <span>• {q.options.length} Answer Choices</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all select-none shrink-0" onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => handleReorderQuestion(section.id, qIdx, 'up')}
                                      disabled={qIdx === 0}
                                      className={`p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer ${qIdx === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                                      title="Move Question Up"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleReorderQuestion(section.id, qIdx, 'down')}
                                      disabled={qIdx === sectionQuestions.length - 1}
                                      className={`p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer ${qIdx === sectionQuestions.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                                      title="Move Question Down"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenSkipLogic(q)}
                                      className="p-1 rounded border border-border-light bg-bg-elevated hover:bg-green-soft/20 text-text-secondary hover:text-green cursor-pointer"
                                      title="Skip Logic Rules"
                                    >
                                      <Sliders className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditQuestion(q)}
                                      className="p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer"
                                      title="Edit Question"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteQuestion(q.id, q.question_text)}
                                      className="p-1 rounded border border-border-light bg-bg-elevated hover:bg-red-soft/20 text-text-secondary hover:text-red cursor-pointer"
                                      title="Delete Question"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
              <ClipboardList className="w-14 h-14 text-green/40 mb-3" />
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">No Form Selected</h3>
              <p className="text-[10px] text-text-tertiary max-w-[280px] mt-1 leading-relaxed">
                Choose an existing form from the sidebar, or create a new form using the "+ New Form" button.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Form Modal Overlay */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9000] select-none text-left">
          <div className="bg-bg-surface border border-border rounded-lg max-w-md w-full p-5 shadow-modal animate-scale-up space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <FolderPlus className="w-4.5 h-4.5 text-green" />
                <span>Create New Survey Form</span>
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateForm} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Form Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Field Inspection Survey" 
                  value={formName}
                  onChange={handleNameChange}
                  className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Slug (URL Path)</label>
                <input 
                  type="text" 
                  placeholder="e.g. field-inspection-survey" 
                  value={formSlug}
                  onChange={(e) => setFormSlug(slugify(e.target.value))}
                  className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Description</label>
                <textarea 
                  placeholder="Optional brief description of what this form collects..." 
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  disabled={isSavingForm}
                >
                  {isSavingForm ? 'Creating...' : 'Create Form'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Question Modal Overlay */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9000] select-none text-left">
          <div className="bg-bg-surface border border-border rounded-lg max-w-lg w-full p-5 shadow-modal animate-scale-up space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <HelpCircle className="w-4.5 h-4.5 text-green" />
                <span>{editingQuestionId ? 'Edit Survey Question' : 'Add New Question'}</span>
              </h3>
              <button 
                onClick={() => setIsQuestionModalOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Question Prompt</label>
                <input 
                  type="text" 
                  placeholder="e.g. What is the business category?" 
                  value={questionText}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setQuestionText(txt);
                    // Autofill csv_column if adding and empty
                    if (!editingQuestionId && !csvColumn) {
                      setCsvColumn(slugify(txt).replace(/-/g, '_'));
                    }
                  }}
                  className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Question Type</label>
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                    className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green"
                  >
                    {QUESTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">CSV Header Column Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. business_category" 
                    value={csvColumn}
                    onChange={(e) => setCsvColumn(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-1 select-none">
                <input 
                  type="checkbox" 
                  id="isRequired"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-green bg-bg-input border border-border focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="isRequired" className="text-xs font-semibold text-text-secondary cursor-pointer select-none">
                  Make this question mandatory (Field is required)
                </label>
              </div>

              {/* Conditional Answer Choices Editor (select / multi_select) */}
              {['select', 'multi_select'].includes(questionType) && (
                <div className="border border-border/80 bg-bg-elevated/20 rounded-lg p-3.5 space-y-3 select-none">
                  <div className="flex justify-between items-center pb-1 border-b border-border/40">
                    <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">Answer Choices</span>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-[10px] font-bold text-green hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Choice</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {questionOptions.length === 0 ? (
                      <p className="text-[10px] text-text-tertiary text-center py-2">No choices added yet.</p>
                    ) : (
                      questionOptions.map((opt, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <span className="text-[10px] font-mono text-text-tertiary w-4 shrink-0 text-right">{idx + 1}.</span>
                          <input 
                            type="text"
                            value={opt}
                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                            placeholder={`e.g. Option ${idx + 1}`}
                            className="flex-1 bg-bg-input border border-border-light rounded px-2.5 py-1 text-xs text-text-primary outline-none focus:border-green"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="p-1 rounded bg-bg-elevated hover:bg-red-soft/20 text-text-secondary hover:text-red cursor-pointer"
                            title="Remove Choice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-border/60 pt-3 select-none">
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setIsQuestionModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  disabled={isSavingQuestion}
                >
                  {isSavingQuestion ? 'Saving...' : 'Save Question'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Skip Logic Modal Overlay */}
      {isLogicModalOpen && logicSourceQuestion && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9000] select-none text-left">
          <div className="bg-bg-surface border border-border rounded-lg max-w-xl w-full p-5 shadow-modal animate-scale-up space-y-4.5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4.5 h-4.5 text-green" />
                <span>Skip Logic Rules</span>
              </h3>
              <button 
                onClick={() => setIsLogicModalOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Source question label */}
            <div className="p-3 bg-bg-elevated/40 border border-border/60 rounded-lg space-y-1">
              <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Source Trigger Question</span>
              <p className="text-xs font-bold text-text-primary leading-normal">{logicSourceQuestion.question_text}</p>
            </div>

            {/* Add skip logic rule form */}
            <form onSubmit={handleSaveSkipRule} className="p-4 bg-bg-elevated/20 border border-border/80 rounded-xl space-y-3.5">
              <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider block border-b border-border/30 pb-1.5">
                Create Skip Condition
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Action</label>
                  <select
                    value={logicAction}
                    onChange={(e) => setLogicAction(e.target.value)}
                    className="w-full bg-bg-input border border-border-light rounded-md px-3 py-1.5 text-xs text-text-primary outline-none focus:border-green"
                  >
                    <option value="show">Show</option>
                    <option value="hide">Hide</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Target Type</label>
                  <select
                    value={logicTargetType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLogicTargetType(val);
                      if (val === 'question') {
                        const targetQs = questions.filter(q => q.id !== logicSourceQuestion.id);
                        setLogicTargetId(targetQs.length > 0 ? targetQs[0].id : '');
                      } else {
                        setLogicTargetId(sections.length > 0 ? sections[0].id : '');
                      }
                    }}
                    className="w-full bg-bg-input border border-border-light rounded-md px-3 py-1.5 text-xs text-text-primary outline-none focus:border-green"
                  >
                    <option value="question">Question</option>
                    <option value="section">Section</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Target Element</label>
                  <select
                    value={logicTargetId}
                    onChange={(e) => setLogicTargetId(e.target.value)}
                    className="w-full bg-bg-input border border-border-light rounded-md px-3 py-1.5 text-xs text-text-primary outline-none focus:border-green font-semibold"
                    required
                  >
                    <option value="" disabled>Select Target...</option>
                    {logicTargetType === 'question' ? (
                      questions
                        .filter(q => q.id !== logicSourceQuestion.id)
                        .map(q => (
                          <option key={q.id} value={q.id}>{q.question_text}</option>
                        ))
                    ) : (
                      sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Condition</label>
                    <select
                      value={logicOperator}
                      onChange={(e) => setLogicOperator(e.target.value)}
                      className="w-full bg-bg-input border border-border-light rounded-md px-3 py-1.5 text-xs text-text-primary outline-none focus:border-green"
                    >
                      {LOGIC_OPERATORS.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Value</label>
                    <input
                      type="text"
                      placeholder="e.g. Yes"
                      value={logicValue}
                      onChange={(e) => setLogicValue(e.target.value)}
                      className="w-full bg-bg-input border border-border-light rounded-md px-3 py-1.5 text-xs text-text-primary outline-none focus:border-green"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  disabled={isSavingLogic || !logicTargetId}
                  className="font-bold px-4"
                >
                  <Plus className="w-3.5 h-3.5 text-white mr-1" />
                  <span>{isSavingLogic ? 'Saving...' : 'Add Skip Rule'}</span>
                </Button>
              </div>
            </form>

            {/* List of existing logic rules */}
            <div className="space-y-2 select-none">
              <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Active Rules Triggered by this Question</span>
              <div className="divide-y divide-border/40 border border-border/60 rounded-xl overflow-hidden bg-bg-surface/50 max-h-[220px] overflow-y-auto">
                {questionRules.filter(r => r.source_question_id === logicSourceQuestion.id).length === 0 &&
                 sectionRules.filter(r => r.source_question_id === logicSourceQuestion.id).length === 0 ? (
                  <p className="text-[10px] text-text-tertiary text-center py-6">No logic rules created for this question yet.</p>
                ) : (
                  <>
                    {/* Question targeted rules */}
                    {questionRules
                      .filter(r => r.source_question_id === logicSourceQuestion.id)
                      .map((rule) => (
                        <div key={rule.id} className="p-3 hover:bg-bg-elevated/20 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <GitCommit className="w-4 h-4 text-green shrink-0 mt-0.5" />
                            <span className="text-text-secondary leading-normal min-w-0 flex-1">
                              {getRuleDescription(rule, false)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestionRule(rule.id)}
                            className="p-1 rounded bg-bg-elevated hover:bg-red-soft/20 text-text-secondary hover:text-red border border-border-light cursor-pointer shrink-0"
                            title="Delete Skip Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                    {/* Section targeted rules */}
                    {sectionRules
                      .filter(r => r.source_question_id === logicSourceQuestion.id)
                      .map((rule) => (
                        <div key={rule.id} className="p-3 hover:bg-bg-elevated/20 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <FolderOpen className="w-4 h-4 text-green shrink-0 mt-0.5" />
                            <span className="text-text-secondary leading-normal min-w-0 flex-1">
                              {getRuleDescription(rule, true)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteSectionRule(rule.id)}
                            className="p-1 rounded bg-bg-elevated hover:bg-red-soft/20 text-text-secondary hover:text-red border border-border-light cursor-pointer shrink-0"
                            title="Delete Skip Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-border/60 pt-3.5 select-none">
              <Button 
                type="button" 
                variant="secondary" 
                size="sm" 
                onClick={() => setIsLogicModalOpen(false)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Live Form Simulator Preview Modal Overlay */}
      {isPreviewOpen && selectedForm && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9000] select-none text-left">
          <div className="bg-bg-surface border border-border rounded-xl max-w-2xl w-full p-5 shadow-modal animate-scale-up max-h-[92vh] flex flex-col overflow-hidden text-xs">
            <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <div>
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-green" />
                  <span>Form Simulator: {selectedForm.name}</span>
                </h3>
                <p className="text-[10px] text-text-secondary mt-0.5">Live rendering of skip logic and validations.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetPreview}
                  className="px-2.5 py-1 rounded bg-bg-elevated border border-border-light hover:border-green-soft text-text-secondary hover:text-green flex items-center gap-1 cursor-pointer"
                  title="Reset all inputs"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Form</span>
                </button>
                <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="text-text-secondary hover:text-text-primary cursor-pointer p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Preview Form Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {sections.length === 0 ? (
                <div className="text-center py-20 text-text-tertiary">
                  <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="font-bold">No form sections to preview.</p>
                </div>
              ) : (
                sections
                  .filter(sec => isSectionVisible(sec.id))
                  .map((sec, secIdx) => {
                    const sectionQuestions = questions
                      .filter(q => q.section_id === sec.id && isQuestionVisible(q))
                      .sort((a, b) => a.sort_order - b.sort_order);

                    if (sectionQuestions.length === 0) {
                      return null; // Skip rendering section if all questions are skipped
                    }

                    return (
                      <div key={sec.id} className="space-y-3.5 border-l-2 border-green/30 pl-4 py-1">
                        <div>
                          <Badge variant="success" size="sm" className="font-bold uppercase text-[9px] mb-1">
                            Section: {sec.name}
                          </Badge>
                          {sec.description && (
                            <p className="text-[10px] text-text-secondary">{sec.description}</p>
                          )}
                        </div>

                        <div className="space-y-4">
                          {sectionQuestions.map((q) => {
                            const val = previewAnswers[q.id];
                            return (
                              <div key={q.id} className="bg-bg-elevated/20 border border-border/40 rounded-lg p-3.5 space-y-2 select-none">
                                <label className="block text-xs font-bold text-text-primary leading-normal">
                                  {q.question_text}
                                  {q.is_required && <span className="text-red ml-0.5 font-bold">*</span>}
                                </label>

                                {/* Conditional Render based on question type */}
                                {q.question_type === 'text' && (
                                  <input
                                    type="text"
                                    value={val || ''}
                                    onChange={(e) => handlePreviewAnswerChange(q.id, e.target.value)}
                                    placeholder="Enter text answer..."
                                    className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green"
                                  />
                                )}

                                {q.question_type === 'number' && (
                                  <input
                                    type="number"
                                    value={val || ''}
                                    onChange={(e) => handlePreviewAnswerChange(q.id, e.target.value)}
                                    placeholder="Enter numeric value..."
                                    className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green"
                                  />
                                )}

                                {q.question_type === 'boolean' && (
                                  <div className="flex gap-4 items-center py-0.5">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`bool_${q.id}`}
                                        value="Yes"
                                        checked={val === 'Yes'}
                                        onChange={() => handlePreviewAnswerChange(q.id, 'Yes')}
                                        className="w-4 h-4 text-green focus:ring-0 cursor-pointer"
                                      />
                                      <span>Yes</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`bool_${q.id}`}
                                        value="No"
                                        checked={val === 'No'}
                                        onChange={() => handlePreviewAnswerChange(q.id, 'No')}
                                        className="w-4 h-4 text-green focus:ring-0 cursor-pointer"
                                      />
                                      <span>No</span>
                                    </label>
                                  </div>
                                )}

                                {q.question_type === 'select' && (
                                  <select
                                    value={val || ''}
                                    onChange={(e) => handlePreviewAnswerChange(q.id, e.target.value)}
                                    className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green"
                                  >
                                    <option value="">Select Option...</option>
                                    {q.options && q.options.map((opt, oIdx) => (
                                      <option key={oIdx} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                )}

                                {q.question_type === 'multi_select' && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-1 select-none">
                                    {q.options && q.options.map((opt, oIdx) => {
                                      const checked = (val || []).includes(opt);
                                      return (
                                        <label key={oIdx} className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => handlePreviewMultiSelectChange(q.id, opt, e.target.checked)}
                                            className="w-4 h-4 rounded border border-border text-green focus:ring-0 cursor-pointer"
                                          />
                                          <span>{opt}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}

                                {q.question_type === 'date' && (
                                  <input
                                    type="date"
                                    value={val || ''}
                                    onChange={(e) => handlePreviewAnswerChange(q.id, e.target.value)}
                                    className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green"
                                  />
                                )}

                                {q.question_type === 'time' && (
                                  <input
                                    type="time"
                                    value={val || ''}
                                    onChange={(e) => handlePreviewAnswerChange(q.id, e.target.value)}
                                    className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green"
                                  />
                                )}

                                {q.question_type === 'gps' && (
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      readOnly
                                      value={val ? `Lat: ${val.lat}, Lng: ${val.lng}` : ''}
                                      placeholder="GPS Coordinates (Click Get GPS)"
                                      className="flex-1 bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none font-mono"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handlePreviewAnswerChange(q.id, { lat: (0.3476 + Math.random()*0.01).toFixed(4), lng: (32.5825 + Math.random()*0.01).toFixed(4) })}
                                      className="px-3 py-2 bg-bg-elevated border border-border-light rounded-md text-text-secondary hover:text-green flex items-center gap-1 cursor-pointer"
                                    >
                                      <Compass className="w-3.5 h-3.5" />
                                      <span>Get GPS</span>
                                    </button>
                                  </div>
                                )}

                                {q.question_type === 'photo' && (
                                  <div className="flex gap-3 items-center select-none">
                                    <div className="w-12 h-12 rounded bg-bg-elevated border border-border-light flex items-center justify-center text-text-tertiary">
                                      <Camera className="w-5 h-5" />
                                    </div>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      disabled
                                      className="text-xs text-text-secondary"
                                    />
                                  </div>
                                )}

                                {q.question_type === 'note' && (
                                  <div className="bg-green-soft/10 border-l-2 border-green p-2 text-[10px] text-text-secondary leading-relaxed">
                                    Note: Display message above. No input response required.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="flex justify-end border-t border-border/60 pt-3.5 shrink-0 select-none">
              <Button 
                type="button" 
                variant="secondary" 
                size="sm" 
                onClick={() => setIsPreviewOpen(false)}
              >
                Close Simulator
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
