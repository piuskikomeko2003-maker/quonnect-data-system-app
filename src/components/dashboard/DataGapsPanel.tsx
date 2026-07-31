'use client';

import React, { useState, useEffect } from 'react';

interface GapVendor {
  id: number;
  name: string;
  business: string;
  phone: string;
  email: string;
  category: string;
  hasData: boolean;
  confirmed: boolean;
  lastSeen: string;
  edCount: number;
  editionsAttended: string[];
  location?: string;
  employees?: number;
  revenue?: string;
}

const gapEditions: Record<string, { id: string; name: string; date: string; venue: string }> = {
  nov2025: { id: 'nov2025', name: 'Nov 2025', date: 'Nov 22, 2025', venue: 'Motiv Bugolobi' },
  dec2025: { id: 'dec2025', name: 'Dec 2025', date: 'Dec 20, 2025', venue: 'Motiv Bugolobi' },
  jan2026: { id: 'jan2026', name: 'Jan 2026', date: 'Jan 24, 2026', venue: 'Motiv Bugolobi' },
  feb2026: { id: 'feb2026', name: 'Feb 2026', date: 'Feb 28, 2026', venue: 'Motiv Bugolobi' },
  mar2026: { id: 'mar2026', name: 'Mar 2026', date: 'Mar 28, 2026', venue: 'Motiv Bugolobi' },
  apr2026: { id: 'apr2026', name: 'Apr 2026', date: 'Apr 25, 2026', venue: 'Motiv Bugolobi' }
};

const seedGapVendors = [
  { name: "Bibas Wild Opal", business: "Bibas Wild Opal", phone: "0777468216", email: "Bibascan@gmail.com", category: "Beauty & Health", hasData: true, edCount: 3, editionsAttended: ['nov2025', 'feb2026', 'apr2026'], location: "Kampala", employees: 2, revenue: "500k-1M" },
  { name: "Ever beautiful skin care", business: "Ever beautiful skin care", phone: "0704091820", email: "suedm8282@gmail.com", category: "Beauty & Health", hasData: true, edCount: 2, editionsAttended: ['mar2026', 'apr2026'], location: "Kampala", employees: 3 },
  { name: "Ella and Stitch", business: "Ella and Stitch", phone: "0756079542", email: "", category: "Fashion & Accessories", hasData: false, edCount: 3, editionsAttended: ['nov2025', 'jan2026', 'apr2026'], location: "Kampala", employees: 2, revenue: "500k-1M" },
  { name: "Shoner mega clothes", business: "Shoner mega clothes", phone: "0704969384", email: "Shoner84@mega.com", category: "Fashion & Accessories", hasData: false, edCount: 1, editionsAttended: ['apr2026'], location: "Kampala", employees: 1 },
  { name: "Agiga sports apparel", business: "Agiga sports apparel", phone: "0758003766", email: "Lanieglenn322@gmail.com", category: "Fashion & Accessories", hasData: true, edCount: 1, editionsAttended: ['apr2026'] },
  { name: "Em's Nook", business: "Em's Nook", phone: "0702744744", email: "emilynyakaisiki23@gmail.com", category: "Fashion & Accessories", hasData: true, edCount: 2, editionsAttended: ['feb2026', 'apr2026'] },
  { name: "Thrift by Ronah", business: "Thrift by Ronah", phone: "0743754381", email: "ronahkyeyune@gmail.com", category: "Fashion & Accessories", hasData: true, edCount: 3, editionsAttended: ['dec2025', 'mar2026', 'apr2026'] },
  { name: "Carol Watches", business: "Carol Watches", phone: "0708361113", email: "carolynie1004@icloud.com", category: "Fashion & Accessories", hasData: true, edCount: 2, editionsAttended: ['jan2026', 'apr2026'] },
  { name: "Rozalyn", business: "Rozalyn", phone: "0773848022", email: "laurynkyomugisha@gmail.com", category: "Beauty & Health", hasData: true, edCount: 2, editionsAttended: ['feb2026', 'apr2026'] },
  { name: "Her select Ug", business: "Her select Ug", phone: "0759317342", email: "kamulinuluat@gmail.com", category: "Beauty & Health", hasData: true, edCount: 3, editionsAttended: ['nov2025', 'jan2026', 'apr2026'] }
];

export const DataGapsPanel: React.FC = () => {
  const [vendors, setVendors] = useState<GapVendor[]>([]);
  const [previousData, setPreviousData] = useState<Record<number, { location: string; employees: number; revenue: string; lastEdition: string }>>({});
  const [gapCurrentEdition, setGapCurrentEdition] = useState<string>('apr2026');
  const [gapActiveFilter, setGapActiveFilter] = useState<'all' | 'autofill' | 'manual' | 'missing'>('all');
  const [confirmAutoFillId, setConfirmAutoFillId] = useState<number | null>(null);
  const [modalVendorId, setModalVendorId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }>>([]);

  // Load and seed the vendors list once on mount
  useEffect(() => {
    let list: GapVendor[] = seedGapVendors.map((v, idx) => ({
      ...v,
      id: idx + 1,
      confirmed: true,
      lastSeen: "Apr 2026"
    }));

    // Generate additional random vendors up to 120
    const editionKeys = Object.keys(gapEditions);
    for (let i = list.length + 1; i <= 120; i++) {
      const edCount = Math.floor(Math.random() * 3) + 1;
      const attended: string[] = [];
      while (attended.length < edCount) {
        const key = editionKeys[Math.floor(Math.random() * editionKeys.length)];
        if (!attended.includes(key)) {
          attended.push(key);
        }
      }
      list.push({
        id: i,
        name: `Vendor ${i}`,
        business: `Business ${i}`,
        phone: `07${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `vendor${i}@example.com`,
        category: ["Fashion", "Beauty", "Food", "Art"][Math.floor(Math.random() * 4)],
        hasData: Math.random() > 0.4,
        confirmed: true,
        lastSeen: "Apr 2026",
        edCount: edCount,
        editionsAttended: attended,
        location: "Kampala",
        employees: Math.floor(Math.random() * 8) + 1,
        revenue: ["500k-1M", "1M-3M", "3M-5M"][Math.floor(Math.random() * 3)]
      });
    }

    setVendors(list);

    // Build previous data for auto-fill candidates
    const prevMap: Record<number, { location: string; employees: number; revenue: string; lastEdition: string }> = {};
    list.forEach(v => {
      if (v.edCount > 1 && !v.hasData) {
        prevMap[v.id] = {
          location: v.location || "Kampala",
          employees: v.employees || 2,
          revenue: v.revenue || "500k-1M",
          lastEdition: gapEditions[v.editionsAttended?.[v.editionsAttended.length - 2]]?.name || "Previous"
        };
      }
    });
    setPreviousData(prevMap);
  }, []);

  const showGapToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const getMissingVendors = () => {
    return vendors.filter(v => v.confirmed && !v.hasData && v.editionsAttended?.includes(gapCurrentEdition));
  };

  const getAutoFillVendors = () => {
    return getMissingVendors().filter(v => v.edCount > 1);
  };

  const getManualVendors = () => {
    return getMissingVendors().filter(v => v.edCount === 1);
  };

  const getConfirmedCount = () => {
    return vendors.filter(v => v.confirmed && v.editionsAttended?.includes(gapCurrentEdition)).length;
  };

  const markGapDataCollected = (id: number) => {
    setVendors(prev => prev.map(v => v.id === id ? { ...v, hasData: true } : v));
    const vendor = vendors.find(v => v.id === id);
    if (vendor) {
      showGapToast(`Data marked as collected for ${vendor.name}`, 'success');
    }
  };

  const handleConfirmAutoFill = (id: number) => {
    setVendors(prev => prev.map(v => v.id === id ? { ...v, hasData: true } : v));
    const vendor = vendors.find(v => v.id === id);
    if (vendor) {
      showGapToast(`Data auto-filled for ${vendor.name}`, 'success');
    }
    setConfirmAutoFillId(null);
  };

  // Metrics definitions
  const missing = getMissingVendors().length;
  const autoFill = getAutoFillVendors().length;
  const manual = getManualVendors().length;
  const confirmedCount = getConfirmedCount();
  const completionRate = confirmedCount > 0 ? Math.round((confirmedCount - missing) / confirmedCount * 100) : 0;

  // Filter list selection
  let filtered = getMissingVendors();
  if (gapActiveFilter === 'autofill') filtered = getAutoFillVendors();
  if (gapActiveFilter === 'manual') filtered = getManualVendors();

  const selectedModalVendor = vendors.find(v => v.id === modalVendorId);

  return (
    <div className="datagaps-module">
      {/* Tabler Icons and exact CSS injected locally for pixel-perfect fidelity */}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.30.0/dist/tabler-icons.min.css" />
      <style dangerouslySetInnerHTML={{ __html: `
        .datagaps-module {
          --bg: #0a0e14;
          --bg-surface: #11161e;
          --bg-elevated: #161c26;
          --bg-hover: #1a2130;
          --bg-input: #0d1117;
          --border: #1e2a3a;
          --border-light: #243044;
          --green: #00e676;
          --green-muted: rgba(0, 230, 118, 0.12);
          --green-soft: rgba(0, 230, 118, 0.08);
          --amber: #ffb300;
          --amber-muted: rgba(255, 179, 0, 0.12);
          --red: #ff5252;
          --red-muted: rgba(255, 82, 82, 0.12);
          --blue: #4dabf7;
          --blue-muted: rgba(77, 171, 247, 0.12);
          --purple: #c084fc;
          --purple-muted: rgba(192, 132, 252, 0.12);
          --text-primary: #e8edf4;
          --text-secondary: #8b949e;
          --text-tertiary: #5c6670;
          --text-muted: #3d4650;
          --radius-sm: 6px;
          --radius-md: 10px;
          --radius-lg: 16px;
          --radius-xl: 20px;
          --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
          --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.5);
          --shadow-modal: 0 20px 60px rgba(0, 0, 0, 0.7);
          --transition: 0.2s ease;
        }
        .datagaps-module .top-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
        .datagaps-module .top-bar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .datagaps-module .top-bar-left h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.025em; display: flex; align-items: center; gap: 8px; margin: 0; color: var(--text-primary); }
        .datagaps-module .top-bar-left h1 i { color: var(--green); }
        .datagaps-module .market-badge { padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; border: 1px solid transparent; }
        .datagaps-module .market-badge.flagship { background: var(--green-muted); color: var(--green); border-color: rgba(0,230,118,0.1); }
        
        .datagaps-module .edition-badge { background: var(--green-muted); padding: 8px 18px; border-radius: 40px; font-size: 13px; font-weight: 600; color: var(--green); display: flex; align-items: center; gap: 8px; }

        .datagaps-module .edition-selector { display: flex; gap: 4px; background: var(--bg-surface); border-radius: var(--radius-md); padding: 3px; border: 1px solid var(--border); flex-wrap: wrap; }
        .datagaps-module .edition-chip { background: transparent; border: none; color: var(--text-secondary); padding: 6px 14px; font-size: 11px; font-weight: 600; border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition); }
        .datagaps-module .edition-chip:hover { color: var(--text-primary); }
        .datagaps-module .edition-chip.active { background: var(--bg-elevated); color: var(--green); border: 1px solid var(--border-light); box-shadow: var(--shadow-card); font-weight: 700; }

        .datagaps-module .metric-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px; }
        @media (min-width: 640px) { .datagaps-module .metric-row { grid-template-columns: repeat(4, 1fr); } }
        .datagaps-module .metric-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px 20px; transition: all var(--transition); position: relative; overflow: hidden; cursor: pointer; text-align: left; }
        .datagaps-module .metric-card:hover { border-color: var(--border-light); box-shadow: var(--shadow-elevated); transform: translateY(-1px); }
        .datagaps-module .metric-card.active-filter { border-color: var(--green); background: var(--green-soft); box-shadow: 0 0 0 1px var(--green); }
        .datagaps-module .metric-card .metric-label { font-size: 10px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .datagaps-module .metric-card .metric-value { font-size: 30px; font-weight: 700; letter-spacing: -0.5px; line-height: 1; color: var(--text-primary); }
        .datagaps-module .metric-card .metric-value.green { color: var(--green); }
        .datagaps-module .metric-card .metric-value.amber { color: var(--amber); }
        .datagaps-module .metric-card .metric-value.red { color: var(--red); }
        .datagaps-module .metric-card .metric-value.blue { color: var(--blue); }
        .datagaps-module .metric-card .metric-sub { font-size: 10px; color: var(--text-tertiary); margin-top: 6px; }

        .datagaps-module .filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 18px; }
        .datagaps-module .filter-chip { background: var(--bg-elevated); border: 1px solid var(--border-light); border-radius: 40px; padding: 6px 14px; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; color: var(--text-secondary); }
        .datagaps-module .btn-clear { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
        .datagaps-module .btn-clear:hover { color: var(--red); }

        .datagaps-module .gap-list { display: flex; flex-direction: column; gap: 12px; }
        .datagaps-module .gap-item { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; transition: all var(--transition); text-align: left; }
        .datagaps-module .gap-item.auto-fill { border-left: 3px solid var(--green); background: var(--green-soft); }
        .datagaps-module .gap-item.manual { border-left: 3px solid var(--red); background: var(--red-muted); }
        .datagaps-module .gap-item:hover { border-color: var(--green); transform: translateX(2px); }
        .datagaps-module .vendor-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--green-muted); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: var(--green); cursor: pointer; flex-shrink: 0; }
        .datagaps-module .vendor-info { flex: 1; }
        .datagaps-module .vendor-name { font-weight: 700; font-size: 14px; cursor: pointer; margin-bottom: 4px; color: var(--text-primary); }
        .datagaps-module .vendor-name:hover { color: var(--green); }
        .datagaps-module .vendor-details { font-size: 11px; color: var(--text-tertiary); display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; }
        .datagaps-module .action-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
        .datagaps-module .action-btn { background: var(--bg-elevated); border: 1px solid var(--border-light); color: var(--text-secondary); border-radius: 30px; padding: 6px 14px; font-size: 11px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all var(--transition); }
        .datagaps-module .action-btn:hover { border-color: var(--green); color: var(--green); background: var(--green-soft); }
        .datagaps-module .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 40px; font-size: 10px; font-weight: 600; }
        .datagaps-module .pill-success { background: var(--green-muted); color: var(--green); }
        .datagaps-module .pill-danger { background: var(--red-muted); color: var(--red); }
        
        .datagaps-module .confirm-box { background: var(--bg-elevated); border: 1px solid var(--green); border-radius: var(--radius-lg); padding: 18px; margin-top: 12px; margin-bottom: 12px; text-align: left; }
        .datagaps-module .fields-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 16px 0; }
        .datagaps-module .field-card { background: var(--bg-surface); border-radius: var(--radius-md); padding: 10px 12px; border: 1px solid var(--border); }
        .datagaps-module .field-label { font-size: 9px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 4px; }
        .datagaps-module .field-value { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .datagaps-module .field-value.old-data { color: var(--amber); }

        .datagaps-module .empty-state { text-align: center; padding: 48px 24px; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px solid var(--border); }
        .datagaps-module .empty-state i { font-size: 48px; color: var(--green); margin-bottom: 12px; display: block; }

        .datagaps-module .btn-primary { background: var(--green); color: #000; border: none; font-weight: 600; padding: 10px 18px; border-radius: 30px; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all var(--transition); }
        .datagaps-module .btn-primary:hover { background: #00ff7a; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 230, 118, 0.3); }

        .datagaps-module .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease; }
        .datagaps-module .modal { background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-xl); padding: 28px; max-width: 560px; width: 90%; box-shadow: var(--shadow-modal); position: relative; max-height: 85vh; overflow-y: auto; text-align: left; }
        .datagaps-module .modal-close { position: absolute; top: 16px; right: 16px; width: 32px; height: 32px; border-radius: 50%; background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all var(--transition); }
        .datagaps-module .modal-close:hover { color: var(--red); border-color: var(--red); }
        .datagaps-module .modal-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
        .datagaps-module .modal-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--green-muted); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: var(--green); }
        .datagaps-module .modal-title h3 { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin: 0; }
        .datagaps-module .modal-subtitle { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; }
        .datagaps-module .retention-track { display: flex; align-items: center; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
        .datagaps-module .retention-dot { width: 10px; height: 10px; border-radius: 50%; }
        .datagaps-module .retention-dot.attended { background: var(--green); }
        .datagaps-module .retention-dot.missed { background: var(--red); }
        .datagaps-module .retention-dot.upcoming { background: var(--border); border: 1px solid var(--text-tertiary); }
        .datagaps-module .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
        .datagaps-module .meta-item { background: var(--bg-elevated); border-radius: var(--radius-md); padding: 12px; }
        .datagaps-module .meta-label { font-size: 9px; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; letter-spacing: 0.05em; }
        .datagaps-module .meta-value { font-size: 13px; font-weight: 600; margin-top: 4px; color: var(--text-primary); }
      ` }} />

      {/* TOASTS RENDERING */}
      <div id="toastContainer" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(t => {
          const icon = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info-circle' }[t.type] || 'info-circle';
          return (
            <div 
              key={t.id}
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 16px',
                boxShadow: 'var(--shadow-elevated)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                animation: 'slideIn 0.3s ease',
                borderLeft: `3px solid ${t.type === 'success' ? 'var(--green)' : t.type === 'error' ? 'var(--red)' : t.type === 'warning' ? 'var(--amber)' : 'var(--blue)'}`,
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-primary)'
              }}
            >
              <i className={`ti ti-${icon}`} style={{ color: t.type === 'success' ? 'var(--green)' : t.type === 'error' ? 'var(--red)' : t.type === 'warning' ? 'var(--amber)' : 'var(--blue)' }}></i>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* TOP BAR */}
      <div className="top-bar">
        <div className="top-bar-left">
          <h1><i className="ti ti-alert-triangle"></i> Data Gap Tracking</h1>
          <span className="market-badge flagship">Kampala Market</span>
        </div>
        <div className="edition-badge">
          <i className="ti ti-calendar"></i> {gapEditions[gapCurrentEdition]?.name || 'Apr 2026'} Edition
        </div>
      </div>

      {/* EDITION SELECTOR */}
      <div className="edition-selector" style={{ marginBottom: '20px' }}>
        {Object.keys(gapEditions).map(key => (
          <button 
            key={key} 
            className={`edition-chip ${key === gapCurrentEdition ? 'active' : ''}`}
            onClick={() => {
              setGapCurrentEdition(key);
              setGapActiveFilter('all');
              showGapToast(`Switched to ${gapEditions[key].name} edition`, 'info');
            }}
          >
            {gapEditions[key].name}
          </button>
        ))}
      </div>

      {/* METRIC ROW */}
      <div className="metric-row">
        <div 
          className={`metric-card ${gapActiveFilter === 'missing' ? 'active-filter' : ''}`}
          onClick={() => setGapActiveFilter(prev => prev === 'missing' ? 'all' : 'missing')}
        >
          <div className="metric-label"><i className="ti ti-alert-circle"></i> Total Missing Data</div>
          <div className="metric-value red">{missing}</div>
          <div className="metric-sub">Confirmed vendors without data</div>
        </div>
        <div 
          className={`metric-card ${gapActiveFilter === 'autofill' ? 'active-filter' : ''}`}
          onClick={() => setGapActiveFilter(prev => prev === 'autofill' ? 'all' : 'autofill')}
        >
          <div className="metric-label"><i className="ti ti-copy"></i> Can Auto-Fill</div>
          <div className="metric-value green">{autoFill}</div>
          <div className="metric-sub">Have previous edition data</div>
        </div>
        <div 
          className={`metric-card ${gapActiveFilter === 'manual' ? 'active-filter' : ''}`}
          onClick={() => setGapActiveFilter(prev => prev === 'manual' ? 'all' : 'manual')}
        >
          <div className="metric-label"><i className="ti ti-pencil"></i> Manual Entry Needed</div>
          <div className="metric-value amber">{manual}</div>
          <div className="metric-sub">First-time vendors</div>
        </div>
        <div 
          className="metric-card"
          onClick={() => setGapActiveFilter('all')}
        >
          <div className="metric-label"><i className="ti ti-percentage"></i> Completion Rate</div>
          <div className="metric-value blue">{completionRate}%</div>
          <div className="metric-sub">Data collected vs confirmed</div>
        </div>
      </div>

      {/* FILTER BAR IF FILTER ACTIVE */}
      {gapActiveFilter !== 'all' && (
        <div className="filter-bar">
          <div className="filter-chip">
            <i className="ti ti-filter"></i> {
              gapActiveFilter === 'missing' ? 'All Missing Data' : 
              gapActiveFilter === 'autofill' ? 'Auto-fill Available' : 
              'Manual Entry Needed'
            }
          </div>
          <button className="btn-clear" onClick={() => setGapActiveFilter('all')}>
            <i className="ti ti-x"></i> Clear filters
          </button>
        </div>
      )}

      {/* EMPTY STATE OR GAP LIST */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-check-circle"></i>
          <p>{gapActiveFilter !== 'all' ? 'No vendors match this filter' : 'All confirmed vendors have data collected'}</p>
        </div>
      ) : (
        <div className="gap-list">
          {filtered.map(v => {
            const hasHistory = v.edCount > 1;
            const isConfirmOpen = confirmAutoFillId === v.id;
            const prev = previousData[v.id];

            return (
              <React.Fragment key={v.id}>
                <div className={`gap-item ${hasHistory ? 'auto-fill' : 'manual'}`} id={`gap-${v.id}`}>
                  <div className="vendor-avatar" onClick={() => setModalVendorId(v.id)}>{v.name.charAt(0)}</div>
                  <div className="vendor-info">
                    <div className="vendor-name" onClick={() => setModalVendorId(v.id)}>{v.name} · {v.business || v.name}</div>
                    <div className="vendor-details">
                      <span><i className="ti ti-phone"></i> {v.phone}</span>
                      <span><i className="ti ti-tag"></i> {v.category}</span>
                      <span><i className="ti ti-calendar-stats"></i> {hasHistory ? `Attended ${v.edCount} editions` : 'First-time vendor'}</span>
                    </div>
                    <div className="action-buttons">
                      {hasHistory && (
                        <button 
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!prev) {
                              showGapToast(`No previous data found for ${v.name}`, 'error');
                              return;
                            }
                            setConfirmAutoFillId(prevId => prevId === v.id ? null : v.id);
                          }}
                        >
                          <i className="ti ti-copy"></i> Auto-fill from previous
                        </button>
                      )}
                      <button 
                        className="action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          markGapDataCollected(v.id);
                        }}
                      >
                        <i className="ti ti-check"></i> Mark as collected
                      </button>
                    </div>
                  </div>
                  <span className={`status-pill ${hasHistory ? 'pill-success' : 'pill-danger'}`}>
                    <i className={`ti ti-${hasHistory ? 'history' : 'alert-triangle'}`}></i> {hasHistory ? 'Has history' : 'No history'}
                  </span>
                </div>

                {/* CONFIRM BOX FOR AUTO-FILL */}
                {isConfirmOpen && prev && (
                  <div className="confirm-box" id={`confirm-gap-${v.id}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                      <div className="vendor-avatar" style={{ width: '48px', height: '48px' }}>{v.name.charAt(0)}</div>
                      <div>
                        <strong>{v.name}</strong><br />
                        <span style={{ color: 'var(--text-secondary)' }}>{v.business || v.name}</span>
                      </div>
                      <button 
                        className="btn-clear" 
                        style={{ marginLeft: 'auto' }}
                        onClick={() => setConfirmAutoFillId(null)}
                      >
                        <i className="ti ti-x"></i> Cancel
                      </button>
                    </div>
                    <div className="fields-grid">
                      <div className="field-card">
                        <div className="field-label">Location</div>
                        <div className="field-value old-data">{prev.location || 'Kampala'}</div>
                      </div>
                      <div className="field-card">
                        <div className="field-label">Employees</div>
                        <div className="field-value old-data">{prev.employees || 'N/A'}</div>
                      </div>
                      <div className="field-card">
                        <div className="field-label">Revenue</div>
                        <div className="field-value old-data">{prev.revenue || 'N/A'}</div>
                      </div>
                    </div>
                    <button 
                      className="btn-primary"
                      style={{ width: '100%' }}
                      onClick={() => handleConfirmAutoFill(v.id)}
                    >
                      <i className="ti ti-copy"></i> Confirm & Auto-fill
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* VENDOR PROFILE MODAL */}
      {selectedModalVendor && (
        <div className="modal-overlay" id="gapModal" onClick={(e) => {
          if (e.target === e.currentTarget) setModalVendorId(null);
        }}>
          <div className="modal">
            <button className="modal-close" id="closeGapModalBtn" onClick={() => setModalVendorId(null)}>
              <i className="ti ti-x"></i>
            </button>
            <div className="modal-header">
              <div className="modal-avatar">{selectedModalVendor.name.charAt(0)}</div>
              <div className="modal-title">
                <h3>{selectedModalVendor.name}</h3>
                <div className="modal-subtitle">{selectedModalVendor.business || selectedModalVendor.name} · {selectedModalVendor.category}</div>
              </div>
            </div>
            <div className="retention-track">
              {Object.keys(gapEditions).map(key => {
                const attended = selectedModalVendor.editionsAttended?.includes(key);
                const isCurrent = key === gapCurrentEdition;
                let dotClass = attended ? 'attended' : (isCurrent ? 'upcoming' : 'missed');
                return (
                  <div key={key} style={{ textAlign: 'center' }}>
                    <div className={`retention-dot ${dotClass}`}></div>
                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{gapEditions[key].name.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
            <div className="meta-grid">
              <div className="meta-item">
                <div className="meta-label">Phone</div>
                <div className="meta-value">{selectedModalVendor.phone}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Email</div>
                <div className="meta-value">{selectedModalVendor.email || 'N/A'}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Location</div>
                <div className="meta-value">{selectedModalVendor.location || 'N/A'}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Editions Attended</div>
                <div className="meta-value">{selectedModalVendor.edCount} / {Object.keys(gapEditions).length}</div>
              </div>
            </div>
            <button 
              className="btn-primary" 
              id="modalMarkGapBtn" 
              style={{ width: '100%' }}
              onClick={() => {
                markGapDataCollected(selectedModalVendor.id);
                setModalVendorId(null);
              }}
            >
              <i className="ti ti-check"></i> Mark Data Collected
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
