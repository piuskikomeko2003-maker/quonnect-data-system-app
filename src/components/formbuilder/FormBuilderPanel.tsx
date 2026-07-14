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
  Sparkles
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

export const FormBuilderPanel: React.FC = () => {
  const [forms, setForms] = useState<Form[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  
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

  // Toast notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substring(2, 9);
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
    } catch (err: any) {
      console.error("Error fetching questions:", err);
      addToast(err.message || "Failed to load questions.", "error");
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  useEffect(() => {
    if (selectedFormId) {
      fetchSections(selectedFormId);
      fetchQuestions(selectedFormId);
      setIsAddSectionOpen(false);
      setEditingSectionId(null);
      setIsQuestionModalOpen(false);
      setEditingQuestionId(null);
    } else {
      setSections([]);
      setQuestions([]);
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

  const selectedForm = forms.find(f => f.id === selectedFormId);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[750px] bg-bg-surface border border-border rounded-lg overflow-hidden select-none text-left relative">
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 p-3.5 rounded-lg shadow-lg text-xs font-semibold text-white animate-slide-up pointer-events-auto border ${
              toast.type === 'success' 
                ? 'bg-green-soft/90 border-green text-green' 
                : 'bg-red-soft/90 border-red text-red'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button 
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-text-secondary hover:text-text-primary p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Form Builder Section */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Forms List (320px) */}
        <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r border-border bg-bg-surface/50 p-4.5 flex flex-col overflow-hidden shrink-0">
          <div className="flex justify-between items-center mb-4 select-none shrink-0">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-green" />
              <span>Surveys Forms</span>
            </h3>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-2"
            >
              <Plus className="w-3.5 h-3.5 text-black mr-1" />
              <span>New Form</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {loadingForms ? (
              <div className="flex flex-col items-center justify-center py-10 text-text-tertiary gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-green" />
                <span className="text-[10px]">Loading forms...</span>
              </div>
            ) : forms.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-border rounded-lg">
                <BookOpen className="w-8 h-8 text-text-tertiary mx-auto mb-2 opacity-60" />
                <p className="text-xs font-bold text-text-secondary">No forms found</p>
                <p className="text-[10px] text-text-tertiary mt-1">Create your first database form to begin.</p>
              </div>
            ) : (
              forms.map((form) => {
                const isActive = form.id === selectedFormId;
                return (
                  <div
                    key={form.id}
                    onClick={() => setSelectedFormId(form.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group ${
                      isActive 
                        ? 'bg-green-soft border-green' 
                        : 'bg-bg-elevated/45 border-border/60 hover:border-green-soft hover:bg-green-soft/10'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <span className={`block font-bold text-xs truncate ${isActive ? 'text-green' : 'text-text-primary'}`}>
                        {form.name}
                      </span>
                      <span className="block text-[10px] text-text-tertiary font-mono truncate mt-0.5">
                        /{form.slug}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteForm(form.id, form.name);
                        }}
                        className="p-1 rounded bg-bg-elevated hover:bg-red-soft/20 text-text-secondary hover:text-red border border-border-light cursor-pointer"
                        title="Delete Form"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-green' : 'text-text-tertiary'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Editor Panel */}
        <div className="flex-1 bg-bg-surface/10 overflow-hidden flex flex-col">
          {selectedFormId && selectedForm ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Form Editor Header */}
              <div className="p-4 border-b border-border bg-bg-surface flex items-center justify-between shrink-0 select-none">
                <div>
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">{selectedForm.name}</h2>
                  <p className="text-[10px] text-text-secondary mt-0.5">{selectedForm.description || "No description provided."}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsAddSectionOpen(!isAddSectionOpen)}
                    className="text-[11px]"
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
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleReorderSection(sectionIdx, 'down')}
                                  disabled={sectionIdx === sections.length - 1}
                                  className={`p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer ${sectionIdx === sections.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                                  title="Move Down"
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
                                  <Plus className="w-3 h-3 text-black mr-1" />
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
                            sectionQuestions.map((q, qIdx) => (
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
                            ))
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
    </div>
  );
};
