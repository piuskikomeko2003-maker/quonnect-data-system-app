import React from 'react';
import { FormTemplate } from './types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FileText, Eye, Edit3, Link, Calendar, Lock } from 'lucide-react';

export interface FormCardProps {
  form: FormTemplate;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  onGenerateLink: (id: string) => void;
}

export const FormCard: React.FC<FormCardProps> = ({
  form,
  onEdit,
  onPreview,
  onGenerateLink
}) => {
  const getStatusBadge = (status: FormTemplate['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" size="sm">Active</Badge>;
      case 'draft':
        return <Badge variant="warning" size="sm">Draft</Badge>;
      case 'completed':
        return <Badge variant="neutral" size="sm">Completed</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card 
      className={`relative p-5 overflow-hidden flex flex-col justify-between text-left min-h-[190px] select-none ${
        form.comingSoon ? 'border-border/40 opacity-70 bg-bg-surface/30' : ''
      }`}
      hoverEffect={!form.comingSoon}
    >
      {/* Visual content wrapper */}
      <div className="space-y-4 flex-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md shrink-0 ${form.comingSoon ? 'bg-bg-input text-text-tertiary' : 'bg-green-muted text-green'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary truncate max-w-[200px]" title={form.name}>
                {form.name}
              </h4>
              <div className="flex items-center gap-2 mt-1 select-none">
                <span className="text-[10px] text-text-tertiary font-semibold uppercase">{form.questionCount} questions</span>
                <span className="text-text-muted text-xs">•</span>
                {getStatusBadge(form.status)}
              </div>
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary font-medium">
          <Calendar className="w-3.5 h-3.5" />
          <span>Last edited: {form.lastEdited}</span>
        </div>
      </div>

      {/* Primary actions buttons row */}
      <div className="flex flex-col gap-2 border-t border-border/60 pt-4 mt-3">
        {!form.comingSoon ? (
          <>
            <div className="flex items-center gap-2">
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => onEdit(form.id)}
                className="flex-1 text-[11px]"
              >
                <Edit3 className="w-3.5 h-3.5 text-black" />
                <span>Edit Form</span>
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => onPreview(form.id)}
                className="px-2.5"
                title="Preview Form"
              >
                <Eye className="w-3.5 h-3.5" />
              </Button>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => onGenerateLink(form.id)}
              fullWidth
              className="text-[11px]"
            >
              <Link className="w-3.5 h-3.5" />
              <span>Generate Link</span>
            </Button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-1.5 w-full py-1 text-[11px] font-bold text-text-tertiary uppercase tracking-wider select-none bg-bg-input/60 rounded border border-border/20">
            <Lock className="w-3.5 h-3.5" />
            <span>Coming Soon</span>
          </div>
        )}
      </div>

      {/* Coming Soon Dark Overlay */}
      {form.comingSoon && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[0.5px] pointer-events-none" />
      )}
    </Card>
  );
};
