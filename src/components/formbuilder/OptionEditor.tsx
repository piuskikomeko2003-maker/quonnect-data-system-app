import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, Check, Edit2 } from 'lucide-react';
import { Button } from '../ui/Button';

export interface OptionEditorProps {
  options: string[];
  onChange: (updatedOptions: string[]) => void;
}

export const OptionEditor: React.FC<OptionEditorProps> = ({
  options = [],
  onChange
}) => {
  const [newOption, setNewOption] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOption.trim();
    if (!trimmed) return;
    if (options.includes(trimmed)) {
      alert('This option already exists.');
      return;
    }
    onChange([...options, trimmed]);
    setNewOption('');
  };

  const handleRemoveOption = (index: number) => {
    const updated = options.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(options[index]);
  };

  const handleSaveEdit = (index: number) => {
    const trimmed = editingValue.trim();
    if (!trimmed) return;
    const updated = [...options];
    updated[index] = trimmed;
    onChange(updated);
    setEditingIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...options];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === options.length - 1) return;
    const updated = [...options];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    onChange(updated);
  };

  return (
    <div className="space-y-3.5 text-left select-none">
      <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">
        Configure Choice Options
      </label>

      {/* Options List */}
      <div className="space-y-2">
        {options.length === 0 ? (
          <p className="text-[11px] text-text-muted italic select-none">No options added yet. Insert choices below.</p>
        ) : (
          options.map((option, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-2 bg-slate-50 border border-border rounded-lg p-2"
            >
              {/* Drag Indicator handle / move triggers */}
              <div className="flex flex-col text-text-muted hover:text-text-secondary shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => handleMoveUp(idx)}
                  disabled={idx === 0}
                  className="p-0.5 text-[8px] font-bold disabled:opacity-20 cursor-pointer"
                  title="Move Up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(idx)}
                  disabled={idx === options.length - 1}
                  className="p-0.5 text-[8px] font-bold disabled:opacity-20 cursor-pointer"
                  title="Move Down"
                >
                  ▼
                </button>
              </div>

              {/* Editable Option Text */}
              {editingIndex === idx ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="flex-1 bg-white border border-accent focus:ring-1 focus:ring-accent rounded-md px-2.5 py-1 text-xs text-text-primary outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(idx)}
                    className="p-1.5 text-accent hover:bg-accent-soft rounded cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-between min-w-0 pr-1">
                  <span className="text-xs text-text-primary font-medium truncate">{option}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(idx)}
                      className="p-1 text-text-tertiary hover:text-text-primary rounded cursor-pointer hover:bg-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-1 text-text-tertiary hover:text-red-600 rounded cursor-pointer hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add option form input */}
      <form onSubmit={handleAddOption} className="flex gap-2">
        <input
          type="text"
          placeholder="Enter choice option (e.g. Female)..."
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          className="flex-1 bg-white border border-border focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-2 text-xs text-text-primary outline-none"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="border-accent hover:bg-accent-soft text-accent hover:text-accent cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Option</span>
        </Button>
      </form>
    </div>
  );
};
