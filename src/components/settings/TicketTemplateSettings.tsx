'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Ticket,
  Upload,
  Image as ImageIcon,
  Save,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  Maximize2,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  REQUIRED_TICKET_FIELDS,
  TICKET_FIELD_LABELS,
  DEFAULT_FIELD_POSITIONS,
  RequiredTicketField,
  FieldPositionsMap,
  TicketTemplate,
  SAMPLE_TICKET_DATA,
  validateTicketFieldPositions,
} from '@/types/ticketTemplate';

interface EditionOption {
  id: string;
  name: string;
  editionDate?: string;
  regionName?: string;
  hasTemplate?: boolean;
}

export const TicketTemplateSettings: React.FC = () => {
  const [editions, setEditions] = useState<EditionOption[]>([]);
  const [selectedEditionId, setSelectedEditionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [missingTable, setMissingTable] = useState(false);

  // Template State
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [bgImageUrl, setBgImageUrl] = useState<string>('');
  const [canvasWidth, setCanvasWidth] = useState<number>(1920);
  const [canvasHeight, setCanvasHeight] = useState<number>(1080);
  const [fieldPositions, setFieldPositions] = useState<FieldPositionsMap>({ ...DEFAULT_FIELD_POSITIONS });
  const [activeField, setActiveField] = useState<RequiredTicketField>('vendor_name');

  // Preview container ref & dimensions
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // 1. Fetch available editions and current templates
  const fetchEditions = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) return;

      const { data: marketDays, error: mdErr } = await supabase
        .from('market_days')
        .select('id, name, event_date, regions(name)')
        .order('event_date', { ascending: false });

      if (mdErr) throw mdErr;

      let templateEditionIds = new Set<string>();
      try {
        const { data: templates, error: tmplErr } = await supabase
          .from('ticket_templates')
          .select('edition_id');

        if (tmplErr) {
          if (tmplErr.code === 'PGRST205' || tmplErr.message?.includes('schema cache')) {
            setMissingTable(true);
          }
        } else if (templates) {
          setMissingTable(false);
          templateEditionIds = new Set(templates.map((t: any) => t.edition_id).filter(Boolean));
        }
      } catch {
        setMissingTable(true);
      }

      const formatted: EditionOption[] = (marketDays || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        editionDate: m.event_date,
        regionName: m.regions?.name,
        hasTemplate: templateEditionIds.has(m.id),
      }));

      setEditions(formatted);
      if (formatted.length > 0 && !selectedEditionId) {
        setSelectedEditionId(formatted[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load editions:', err);
      showToast('Failed to load market day editions', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedEditionId]);

  useEffect(() => {
    fetchEditions();
  }, [fetchEditions]);

  // 2. Fetch template for currently selected edition
  const fetchTemplateForEdition = useCallback(async (editionId: string) => {
    if (!editionId) return;
    try {
      const res = await fetch(`/api/tickets/templates?edition_id=${editionId}`);
      const data = await res.json();

      if (data.tableExists === false) {
        setMissingTable(true);
      } else if (data.template) {
        setMissingTable(false);
        const t: TicketTemplate = data.template;
        setCurrentTemplateId(t.id || null);
        setBgImageUrl(t.background_image_url || '');
        setCanvasWidth(t.canvas_width || 1920);
        setCanvasHeight(t.canvas_height || 1080);
        setFieldPositions({
          ...DEFAULT_FIELD_POSITIONS,
          ...(t.field_positions || {}),
        });
        return;
      }

      // Reset to default empty template for this edition
      setCurrentTemplateId(null);
      setBgImageUrl('');
      setCanvasWidth(1920);
      setCanvasHeight(1080);
      setFieldPositions({ ...DEFAULT_FIELD_POSITIONS });
    } catch (err: any) {
      console.error('Failed to fetch template:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedEditionId) {
      fetchTemplateForEdition(selectedEditionId);
    }
  }, [selectedEditionId, fetchTemplateForEdition]);

  // Calculate live preview scaling relative to container width
  useEffect(() => {
    const updateScale = () => {
      if (previewContainerRef.current && canvasWidth > 0) {
        const containerWidth = previewContainerRef.current.clientWidth;
        setPreviewScale(containerWidth / canvasWidth);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [canvasWidth, bgImageUrl]);

  // Handle Background Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size exceeds 10MB limit.', 'error');
      return;
    }

    try {
      setUploadingImage(true);

      // Measure natural dimensions in browser first
      const objectUrl = URL.createObjectURL(file);
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          setCanvasWidth(img.naturalWidth || 1920);
          setCanvasHeight(img.naturalHeight || 1080);
          resolve();
        };
        img.onerror = () => reject(new Error('Invalid image file.'));
        img.src = objectUrl;
      });

      // Upload to Supabase Storage: bucket 'ticket-assets'
      const supabase = createClient();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `backgrounds/${selectedEditionId || 'default'}/${Date.now()}-${sanitizedName}`;

      let uploadedUrl = '';
      if (supabase) {
        const { error: uploadError } = await supabase.storage
          .from('ticket-assets')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicData } = supabase.storage
            .from('ticket-assets')
            .getPublicUrl(storagePath);
          uploadedUrl = publicData.publicUrl;
        } else {
          console.warn('Storage upload notice:', uploadError.message);
        }
      }

      // If storage bucket upload succeeded, use the public URL; otherwise convert to base64 Data URL
      if (uploadedUrl) {
        setBgImageUrl(uploadedUrl);
        showToast('Background uploaded to Supabase Storage!', 'success');
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setBgImageUrl(reader.result);
            showToast('Background image loaded successfully!', 'success');
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.error('Image upload failed:', err);
      showToast(err?.message || 'Failed to process image', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  // Update specific coordinate or styling property for a field
  const updateFieldProperty = (
    field: RequiredTicketField,
    prop: keyof FieldPositionsMap[RequiredTicketField],
    value: any
  ) => {
    setFieldPositions((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [prop]: value,
      },
    }));
  };

  // Click-to-align on preview canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewContainerRef.current || !previewScale || previewScale <= 0) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const clickX = Math.round((e.clientX - rect.left) / previewScale);
    const clickY = Math.round((e.clientY - rect.top) / previewScale);

    // Set position for current active field
    updateFieldProperty(activeField, 'x', Math.max(0, Math.min(canvasWidth, clickX)));
    updateFieldProperty(activeField, 'y', Math.max(0, Math.min(canvasHeight, clickY)));
  };

  // Save Template
  const handleSaveTemplate = async () => {
    if (!bgImageUrl) {
      showToast('Please upload a background image first.', 'error');
      return;
    }

    // Validate all required fields
    const validation = validateTicketFieldPositions(fieldPositions);
    if (!validation.valid) {
      showToast(`Missing field coordinates: ${validation.missing.join(', ')}`, 'error');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/tickets/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edition_id: selectedEditionId,
          background_image_url: bgImageUrl,
          canvas_width: canvasWidth,
          canvas_height: canvasHeight,
          field_positions: fieldPositions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save template');
      }

      setCurrentTemplateId(data.template?.id || null);
      showToast('Ticket template saved successfully!', 'success');
      fetchEditions();
    } catch (err: any) {
      console.error('Save failed:', err);
      showToast(err?.message || 'Error saving template', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Template (Revert to Fallback)
  const handleDeleteTemplate = async () => {
    if (!selectedEditionId) return;
    if (!confirm('Revert this edition to the default ticket design? This will delete the custom template.')) {
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch(`/api/tickets/templates?edition_id=${selectedEditionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to remove template');
      }

      setCurrentTemplateId(null);
      setBgImageUrl('');
      setFieldPositions({ ...DEFAULT_FIELD_POSITIONS });
      showToast('Template deleted. Edition will use the default pass design.', 'info');
      fetchEditions();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete template', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Sample values for real-time overlay
  const sampleValues: Record<RequiredTicketField, string> = {
    vendor_name: SAMPLE_TICKET_DATA.vendorName,
    business_name: SAMPLE_TICKET_DATA.businessName || '',
    category: SAMPLE_TICKET_DATA.category || '',
    phone_number: SAMPLE_TICKET_DATA.phone || '',
    ticket_number: SAMPLE_TICKET_DATA.ticketCode,
    issued_at: new Date(SAMPLE_TICKET_DATA.registeredAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  };

  const selectedEdition = editions.find((e) => e.id === selectedEditionId);

  return (
    <div className="space-y-6 text-left">
      {/* Toast alert */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold animate-fade-in shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : toast.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-blue-50 border-blue-300 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-xs opacity-70 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      {/* Missing Table Warning Banner */}
      {missingTable && (
        <div className="p-4 bg-amber-50 border border-amber-300/80 rounded-2xl text-xs text-amber-900 flex items-start gap-3 shadow-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-amber-950">
              Supabase Migration Required: <code>ticket_templates</code>
            </h4>
            <p className="text-amber-800">
              The <code>ticket_templates</code> table has not been executed in your remote Supabase database yet.
              Until you run the migration, all editions will safely fall back to the default official pass design.
            </p>
            <div className="pt-1">
              <span className="font-semibold block text-[11px] text-amber-900">
                To create the table, run this migration file in your <strong>Supabase Dashboard → SQL Editor</strong>:
              </span>
              <code className="inline-block mt-1 bg-amber-100 border border-amber-200 px-2 py-1 rounded-md font-mono text-[11px] text-amber-950 select-all">
                quonnect-data-system-app/supabase/migrations/add_ticket_templates.sql
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Header & Edition Selector */}
      <div className="bg-bg-surface border border-border/80 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-soft/50 text-accent flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Per-Edition Ticket Designer</h2>
              <p className="text-xs text-text-secondary">
                Upload a custom ticket background and position dynamic vendor fields with live preview.
              </p>
            </div>
          </div>
        </div>

        {/* Edition Dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-tertiary mb-1">
              Select Market Day Edition
            </span>
            <select
              value={selectedEditionId}
              onChange={(e) => setSelectedEditionId(e.target.value)}
              disabled={loading}
              className="bg-bg-input border border-border rounded-lg px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {editions.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.name} {ed.regionName ? `(${ed.regionName})` : ''} {ed.hasTemplate ? '★ [Custom]' : '[Default]'}
                </option>
              ))}
            </select>
          </div>

          <div className="self-end pb-0.5">
            <Badge variant={currentTemplateId ? 'success' : 'neutral'} size="sm">
              {currentTemplateId ? 'Custom Template Active' : 'Default Pass Fallback'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Designer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Controls & Coordinates (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Background Upload Box */}
          <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-accent" />
                Ticket Background Image
              </label>
              <span className="text-[10px] text-text-tertiary">PNG, JPG, WEBP (Max 10MB)</span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-border hover:border-accent hover:bg-accent-soft/20 rounded-xl p-3 cursor-pointer transition-all text-xs font-semibold text-text-secondary hover:text-accent">
                {uploadingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{uploadingImage ? 'Uploading & Measuring...' : 'Upload Background File'}</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
            </div>

            {/* Canvas Dimensions Display */}
            {bgImageUrl && (
              <div className="flex items-center justify-between text-[11px] bg-slate-50 border border-border/60 rounded-lg p-2.5 text-text-secondary">
                <span className="font-medium flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-text-tertiary" />
                  Native Canvas Size:
                </span>
                <span className="font-mono font-bold text-text-primary">
                  {canvasWidth} &times; {canvasHeight} px
                </span>
              </div>
            )}
          </div>

          {/* Field Selector & Coordinate Inputs */}
          <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Field Coordinates & Typography
                </h3>
              </div>
              <span className="text-[10px] text-text-tertiary">Click preview canvas to place</span>
            </div>

            {/* Required Field Buttons / Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {REQUIRED_TICKET_FIELDS.map((field) => {
                const isCurrent = activeField === field;
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => setActiveField(field)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold text-left transition-all border cursor-pointer flex flex-col ${
                      isCurrent
                        ? 'bg-accent text-white border-accent shadow-sm'
                        : 'bg-bg-input/60 text-text-secondary border-border/70 hover:bg-slate-100 hover:text-text-primary'
                    }`}
                  >
                    <span className="truncate">{TICKET_FIELD_LABELS[field]}</span>
                    <span
                      className={`text-[9px] font-mono mt-0.5 ${
                        isCurrent ? 'text-white/80' : 'text-text-tertiary'
                      }`}
                    >
                      X:{fieldPositions[field]?.x ?? 0} Y:{fieldPositions[field]?.y ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Field Property Editor */}
            {activeField && fieldPositions[activeField] && (
              <div className="bg-slate-50/70 border border-border/70 rounded-xl p-4 space-y-3.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent">
                    Editing: {TICKET_FIELD_LABELS[activeField]}
                  </span>
                  <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full font-bold">
                    {activeField}
                  </span>
                </div>

                {/* X and Y Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      X Position (px)
                    </label>
                    <input
                      type="number"
                      value={fieldPositions[activeField].x}
                      onChange={(e) =>
                        updateFieldProperty(activeField, 'x', parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-text-primary focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      Y Position (px)
                    </label>
                    <input
                      type="number"
                      value={fieldPositions[activeField].y}
                      onChange={(e) =>
                        updateFieldProperty(activeField, 'y', parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-text-primary focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                {/* Font Size & Weight */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      Font Size (px)
                    </label>
                    <input
                      type="number"
                      min={8}
                      max={120}
                      value={fieldPositions[activeField].fontSize}
                      onChange={(e) =>
                        updateFieldProperty(
                          activeField,
                          'fontSize',
                          parseInt(e.target.value, 10) || 16
                        )
                      }
                      className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      Font Weight
                    </label>
                    <select
                      value={fieldPositions[activeField].fontWeight || 'normal'}
                      onChange={(e) =>
                        updateFieldProperty(activeField, 'fontWeight', e.target.value as any)
                      }
                      className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:ring-1 focus:ring-accent"
                    >
                      <option value="normal">Regular (400)</option>
                      <option value="medium">Medium (500)</option>
                      <option value="semibold">Semibold (600)</option>
                      <option value="bold">Bold (700)</option>
                    </select>
                  </div>
                </div>

                {/* Color & Max Width */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={fieldPositions[activeField].color || '#000000'}
                        onChange={(e) => updateFieldProperty(activeField, 'color', e.target.value)}
                        className="w-8 h-8 rounded border border-border cursor-pointer p-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={fieldPositions[activeField].color || '#000000'}
                        onChange={(e) => updateFieldProperty(activeField, 'color', e.target.value)}
                        className="w-full bg-white border border-border rounded-lg px-2 py-1 text-xs font-mono text-text-primary uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      Max Width (px, wrap/shrink)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={1200}
                      value={fieldPositions[activeField].maxWidth || 400}
                      onChange={(e) =>
                        updateFieldProperty(
                          activeField,
                          'maxWidth',
                          parseInt(e.target.value, 10) || 400
                        )
                      }
                      className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Template Actions */}
            <div className="pt-2 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={handleSaveTemplate}
                disabled={saving || !bgImageUrl}
                className="flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? 'Saving...' : 'Save Template'}</span>
              </Button>

              {currentTemplateId && (
                <Button
                  variant="secondary"
                  onClick={handleDeleteTemplate}
                  disabled={deleting}
                  className="py-2.5 px-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer"
                  title="Revert edition to default ticket design"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Revert to Default</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Live Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Live Visual Alignment Preview
                </h3>
              </div>

              {/* Test Render Button */}
              {selectedEditionId && (
                <a
                  href={`/api/tickets/render?edition_id=${selectedEditionId}&preview=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-soft/40 hover:bg-accent-soft text-accent text-xs font-bold rounded-lg transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Render PNG</span>
                </a>
              )}
            </div>

            <p className="text-[11px] text-text-secondary">
              Changes to coordinates and fonts update below in real time. Click anywhere on the image to place{' '}
              <strong className="text-accent">{TICKET_FIELD_LABELS[activeField]}</strong> at that spot.
            </p>

            {/* Interactive Preview Canvas Viewport */}
            <div className="w-full bg-slate-900 rounded-xl overflow-hidden border border-border shadow-inner relative flex items-center justify-center min-h-[380px]">
              {bgImageUrl ? (
                <div
                  ref={previewContainerRef}
                  onClick={handleCanvasClick}
                  className="relative cursor-crosshair select-none"
                  style={{
                    width: '100%',
                    height: `${canvasHeight * previewScale}px`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Background Artwork */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bgImageUrl}
                    alt="Ticket Template Preview"
                    style={{
                      width: `${canvasWidth * previewScale}px`,
                      height: `${canvasHeight * previewScale}px`,
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Dynamic Overlaid Fields */}
                  {REQUIRED_TICKET_FIELDS.map((field) => {
                    const pos = fieldPositions[field];
                    if (!pos) return null;
                    const isCurrent = activeField === field;

                    // Scaled values for CSS in preview
                    const scaledX = pos.x * previewScale;
                    const scaledY = pos.y * previewScale;
                    const scaledFontSize = Math.max(8, pos.fontSize * previewScale);
                    const scaledMaxWidth = pos.maxWidth ? pos.maxWidth * previewScale : undefined;

                    return (
                      <div
                        key={field}
                        style={{
                          position: 'absolute',
                          left: `${scaledX}px`,
                          top: `${scaledY}px`,
                          fontSize: `${scaledFontSize}px`,
                          color: pos.color || '#000000',
                          fontWeight: (pos.fontWeight === 'bold' || pos.fontWeight === '700'
                            ? 700
                            : pos.fontWeight === 'semibold' || pos.fontWeight === '600'
                            ? 600
                            : 400) as any,
                          maxWidth: scaledMaxWidth ? `${scaledMaxWidth}px` : undefined,
                          lineHeight: 1.2,
                          wordBreak: 'break-word',
                          outline: isCurrent
                            ? '2px dashed #1d4ed8'
                            : '1px solid rgba(0,0,0,0.1)',
                          backgroundColor: isCurrent ? 'rgba(29, 78, 216, 0.15)' : 'transparent',
                          padding: '1px 3px',
                          borderRadius: '3px',
                          zIndex: isCurrent ? 20 : 10,
                          transition: 'outline 0.15s, background-color 0.15s',
                        }}
                      >
                        {sampleValues[field]}
                        {isCurrent && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '-16px',
                              left: 0,
                              fontSize: '9px',
                              backgroundColor: '#1d4ed8',
                              color: '#ffffff',
                              padding: '1px 4px',
                              borderRadius: '2px',
                              whiteSpace: 'nowrap',
                              fontWeight: 'bold',
                              pointerEvents: 'none',
                            }}
                          >
                            {TICKET_FIELD_LABELS[field]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">No Custom Template Configured</h4>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">
                      Upload a background design on the left to activate a custom pass for this edition.
                      Without a template, the edition will automatically use the default official pass.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Safeguard & Alignment Tips */}
            <div className="bg-accent-soft/20 border border-accent/20 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-text-secondary">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="space-y-1 text-[11px]">
                <p>
                  <strong>Accuracy Guarantee:</strong> All 6 dynamic fields are mandatory and verified before save. Long business names automatically scale down or wrap to avoid overflowing into background art.
                </p>
                <p className="text-text-tertiary">
                  Ticket numbers will always follow the sequentially allocated format (e.g.{' '}
                  <code>TKT-001</code>) issued during registration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
