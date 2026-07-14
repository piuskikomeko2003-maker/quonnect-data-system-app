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
  ChevronRight
} from 'lucide-react';

interface Form {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

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

  useEffect(() => {
    fetchForms();
  }, []);

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
        .select();

      if (error) throw error;

      addToast("Form created successfully!", "success");
      setFormName('');
      setFormSlug('');
      setFormDescription('');
      setIsCreateModalOpen(false);
      
      // Refresh list and select the new form if successfully inserted
      await fetchForms();
      if (data && data[0]) {
        setSelectedFormId(data[0].id);
      }
    } catch (err: any) {
      console.error("Error creating form:", err);
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
              <div className="p-4 border-b border-border bg-bg-surface flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">{selectedForm.name}</h2>
                  <p className="text-[10px] text-text-secondary mt-0.5">{selectedForm.description || "No description provided."}</p>
                </div>
              </div>

              {/* Placeholder for Editor body (Phases 2-5) */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="text-center py-20 border border-dashed border-border rounded-xl">
                  <ClipboardList className="w-12 h-12 text-green mx-auto mb-3" />
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Form Editor</h3>
                  <p className="text-[10px] text-text-secondary max-w-xs mx-auto mt-1 leading-relaxed">
                    Form structure is loaded. In the next phases, we will enable adding sections, questions, logic rules, and live form previews.
                  </p>
                </div>
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
    </div>
  );
};
