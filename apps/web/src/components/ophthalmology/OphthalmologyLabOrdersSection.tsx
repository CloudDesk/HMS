import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ApiClinicalOrderPriority } from '../../api/opd';
import type { ServiceResponse } from '../../api/services';
import type { LabOrderItem } from '../opd/OpdLabSection';
import { MedicalSpinner } from '../ui/MedicalLoader';
import { OphthalmologyOrderIcon } from './OphthalmologyOrderIcon';

export const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

export type OphthalmologyLabOrdersSectionProps = {
  labPriority: ApiClinicalOrderPriority;
  setLabPriority: (val: ApiClinicalOrderPriority) => void;
  labFacility: string;
  setLabFacility: (val: string) => void;
  labFacilities: string[];
  labSampleType: string;
  setLabSampleType: (val: string) => void;
  labSampleTypeOptions: string[];
  labCategory: string;
  setLabCategory: (val: string) => void;
  labCategoryOptions: string[];
  availableLabTests: ServiceResponse[];
  labOrders: LabOrderItem[];
  setLabOrders: React.Dispatch<React.SetStateAction<LabOrderItem[]>>;
  handleToggleLabTest: (test: ServiceResponse) => void;
  labSearchQuery: string;
  setLabSearchQuery: (val: string) => void;
  labClinicalNotes: string;
  setLabClinicalNotes: (val: string) => void;
  labOrderSummary: string;
  setLabOrderSummary: (val: string) => void;
  saveConsultationDraft: () => void;
  handleNextStep: (tab: string) => void;
  handleSubmitLabOrder?: () => void;
  isSubmitting?: boolean;
  canEdit: boolean;
  statusLabel?: string;
};

interface LabCatalogItem {
  id: string;
  code: string;
  name: string;
  sampleType: string;
  category: string;
  tags: string[];
  icon: string;
  iconBg: string;
  iconColor: string;
  defaultStarred?: boolean;
  isConfigured: boolean;
  dbService?: ServiceResponse;
}

interface OphthalmologyLabShortcutTemplate {
  code: string;
  name: string;
  sampleType: string;
  category: string;
  tags: string[];
  icon: string;
  iconBg: string;
  iconColor: string;
  defaultStarred?: boolean;
  matchPatterns: string[];
}

const OPHTHALMOLOGY_SHORTCUT_TEMPLATES: OphthalmologyLabShortcutTemplate[] = [
  {
    code: 'LAB-CATARACT-RET',
    name: 'Pre-Operative Cataract / Retinal Clearance (CBC, PT/INR, Electrolytes)',
    sampleType: 'Whole Blood / Serum / Plasma',
    category: 'Pre-Operative',
    tags: ['Pre-Operative', 'Commonly Used'],
    icon: 'ph-eye',
    iconBg: '#f3e8ff',
    iconColor: '#9333ea',
    defaultStarred: true,
    matchPatterns: ['cataract', 'cbc', 'pt/inr', 'clearance', 'pre-op', 'preoperative'],
  },
  {
    code: 'LAB-UVEITIS-PANEL',
    name: 'Autoimmune Uveitis Panel (ANA, RF, HLA-B27 Typing)',
    sampleType: 'Serum / EDTA Blood',
    category: 'Inflammatory & Autoimmune',
    tags: ['Inflammatory & Autoimmune', 'Commonly Used'],
    icon: 'ph-drop-half-bottom',
    iconBg: '#fee2e2',
    iconColor: '#ef4444',
    matchPatterns: ['uveitis', 'ana', 'rf', 'hla-b27', 'autoimmune'],
  },
  {
    code: 'LAB-ESR-CRP',
    name: 'Erythrocyte Sedimentation Rate (ESR) & C-Reactive Protein (CRP)',
    sampleType: 'Serum / Whole Blood',
    category: 'Inflammatory & Autoimmune',
    tags: ['Inflammatory & Autoimmune', 'Commonly Used'],
    icon: 'ph-flask',
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
    matchPatterns: ['esr', 'crp', 'erythrocyte', 'sedimentation'],
  },
  {
    code: 'LAB-HBA1C-FBS',
    name: 'Glycated Hemoglobin (HbA1c) & Fasting Blood Sugar',
    sampleType: 'EDTA / Whole Blood',
    category: 'Commonly Used',
    tags: ['Commonly Used'],
    icon: 'ph-drop',
    iconBg: '#ffedd5',
    iconColor: '#f97316',
    matchPatterns: ['hba1c', 'fbs', 'sugar', 'glucose', 'glycated'],
  },
  {
    code: 'LAB-AQ-VIT-ASP',
    name: 'Aqueous / Vitreous Aspirate Culture & Sensitivity',
    sampleType: 'Aqueous / Vitreous Aspirate',
    category: 'Ocular & Vision Related',
    tags: ['Ocular & Vision Related'],
    icon: 'ph-drop',
    iconBg: '#e0f2fe',
    iconColor: '#0284c7',
    matchPatterns: ['aqueous', 'vitreous', 'aspirate', 'culture'],
  },
  {
    code: 'LAB-CONJ-CORNEAL',
    name: 'Conjunctival & Corneal Scraping with Gram Stain & KOH Smear',
    sampleType: 'Corneal / Conjunctival Scraping',
    category: 'Ocular & Vision Related',
    tags: ['Ocular & Vision Related', 'Commonly Used'],
    icon: 'ph-eye',
    iconBg: '#f3e8ff',
    iconColor: '#7c3aed',
    matchPatterns: ['conjunctival', 'corneal', 'scraping', 'smear', 'koh'],
  },
];

export function OphthalmologyLabOrdersSection({
  labPriority,
  setLabPriority,
  labFacility,
  setLabFacility,
  labFacilities,
  labSampleType,
  setLabSampleType,
  labSampleTypeOptions,
  labCategory,
  setLabCategory,
  labCategoryOptions,
  availableLabTests,
  labOrders,
  setLabOrders,
  handleToggleLabTest,
  labSearchQuery,
  setLabSearchQuery,
  labClinicalNotes,
  setLabClinicalNotes,
  labOrderSummary,
  setLabOrderSummary,
  saveConsultationDraft,
  handleSubmitLabOrder,
  isSubmitting,
  canEdit,
  statusLabel = 'Draft',
}: OphthalmologyLabOrdersSectionProps) {
  // Category tabs filter state
  const [activeTabFilter, setActiveTabFilter] = useState<string>('All Tests');

  // Track starred items
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    OPHTHALMOLOGY_SHORTCUT_TEMPLATES.forEach((item) => {
      if (item.defaultStarred) init[item.code] = true;
    });
    return init;
  });

  const toggleStar = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    setStarredMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Combine templates matched to real DB services + all remaining configured active lab services
  const unifiedCatalog = useMemo(() => {
    const list: LabCatalogItem[] = [];
    const claimedDbServiceIds = new Set<string>();

    // 1. Process templates first, matching against available database tests
    OPHTHALMOLOGY_SHORTCUT_TEMPLATES.forEach((template) => {
      const matchedSvc = availableLabTests.find((dbSvc) => {
        if (!isValidObjectId(dbSvc.id) || claimedDbServiceIds.has(dbSvc.id)) return false;
        // Exact code match
        if (dbSvc.code && dbSvc.code.trim().toUpperCase() === template.code) return true;
        // Exact name match
        if (dbSvc.name && dbSvc.name.trim().toLowerCase() === template.name.trim().toLowerCase()) return true;
        // Keyword/pattern match
        const lowerName = (dbSvc.name || '').toLowerCase();
        const lowerCode = (dbSvc.code || '').toLowerCase();
        return template.matchPatterns.some(
          (pattern) => lowerName.includes(pattern) || lowerCode.includes(pattern),
        );
      });

      if (matchedSvc) {
        claimedDbServiceIds.add(matchedSvc.id);
        list.push({
          id: matchedSvc.id,
          code: matchedSvc.code || template.code,
          name: matchedSvc.name,
          sampleType: matchedSvc.sample_type || template.sampleType,
          category: template.category,
          tags: [...template.tags, matchedSvc.category || template.category],
          icon: template.icon,
          iconBg: template.iconBg,
          iconColor: template.iconColor,
          defaultStarred: template.defaultStarred,
          isConfigured: true,
          dbService: matchedSvc,
        });
      } else {
        // Test not configured in active catalogue for current branch
        list.push({
          id: `unconfigured-${template.code}`,
          code: template.code,
          name: template.name,
          sampleType: template.sampleType,
          category: template.category,
          tags: [...template.tags],
          icon: template.icon,
          iconBg: template.iconBg,
          iconColor: template.iconColor,
          defaultStarred: template.defaultStarred,
          isConfigured: false,
        });
      }
    });

    // 2. Add all other active DB services from availableLabTests that have valid ObjectIds
    availableLabTests.forEach((dbSvc) => {
      if (!isValidObjectId(dbSvc.id) || claimedDbServiceIds.has(dbSvc.id)) return;
      claimedDbServiceIds.add(dbSvc.id);

      const cat = dbSvc.category || 'General Lab';
      list.push({
        id: dbSvc.id,
        code: dbSvc.code || `LAB-${dbSvc.id.slice(-6).toUpperCase()}`,
        name: dbSvc.name,
        sampleType: dbSvc.sample_type || 'Serum / Whole Blood',
        category: cat,
        tags: ['All Tests', cat, 'Configured Services'],
        icon: 'ph-flask',
        iconBg: '#f1f5f9',
        iconColor: '#0284c7',
        isConfigured: true,
        dbService: dbSvc,
      });
    });

    return list;
  }, [availableLabTests]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const total = unifiedCatalog.length;
    const commonlyUsed = unifiedCatalog.filter((item) => item.tags.includes('Commonly Used') || starredMap[item.id]).length;
    const ocular = unifiedCatalog.filter((item) => item.tags.includes('Ocular & Vision Related') || item.category.includes('Ocular')).length;
    const preOp = unifiedCatalog.filter((item) => item.tags.includes('Pre-Operative') || item.category.includes('Pre-Op')).length;
    const autoImmune = unifiedCatalog.filter((item) => item.tags.includes('Inflammatory & Autoimmune') || item.category.includes('Autoimmune')).length;

    return {
      'All Tests': total,
      'Commonly Used': commonlyUsed,
      'Ocular & Vision Related': ocular,
      'Pre-Operative': preOp,
      'Inflammatory & Autoimmune': autoImmune,
    };
  }, [unifiedCatalog, starredMap]);

  // Filtered display items
  const filteredItems = useMemo(() => {
    return unifiedCatalog.filter((item) => {
      // Tab filter
      if (activeTabFilter === 'Commonly Used' && !item.tags.includes('Commonly Used') && !starredMap[item.id]) {
        return false;
      }
      if (activeTabFilter === 'Ocular & Vision Related' && !item.tags.includes('Ocular & Vision Related') && !item.category.includes('Ocular')) {
        return false;
      }
      if (activeTabFilter === 'Pre-Operative' && !item.tags.includes('Pre-Operative') && !item.category.includes('Pre-Op')) {
        return false;
      }
      if (activeTabFilter === 'Inflammatory & Autoimmune' && !item.tags.includes('Inflammatory & Autoimmune') && !item.category.includes('Autoimmune')) {
        return false;
      }

      // Dropdown Sample Type filter
      if (labSampleType && labSampleType !== 'All Sample Types' && labSampleType !== 'All') {
        const sType = labSampleType.toLowerCase();
        if (!item.sampleType.toLowerCase().includes(sType)) {
          return false;
        }
      }

      // Dropdown Category filter
      if (labCategory && labCategory !== 'All Categories' && labCategory !== 'All') {
        const cat = labCategory.toLowerCase();
        if (!item.category.toLowerCase().includes(cat) && !item.tags.some((t) => t.toLowerCase().includes(cat))) {
          return false;
        }
      }

      // Search Query filter
      if (labSearchQuery.trim()) {
        const q = labSearchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesSample = item.sampleType.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        if (!matchesName && !matchesSample && !matchesCat) return false;
      }

      return true;
    });
  }, [unifiedCatalog, activeTabFilter, labSampleType, labCategory, labSearchQuery, starredMap]);

  // Handle clicking on a card
  const handleCardClick = (item: LabCatalogItem) => {
    if (!canEdit) return;

    if (!item.isConfigured || !isValidObjectId(item.id)) {
      toast.error(
        `Investigation "${item.name}" is not configured in the active laboratory catalogue for this branch. Please configure it under Administration > Services or select an active test.`,
      );
      return;
    }

    // Build or find matching ServiceResponse
    const matchedSvc = availableLabTests.find((s) => s.id === item.id);

    const targetService: ServiceResponse = item.dbService || matchedSvc || {
      id: item.id,
      code: item.code,
      name: item.name,
      service_type: 'LAB_TEST',
      category: item.category,
      sample_type: item.sampleType,
      description: item.name,
      reference_video_url: null,
      reference_video_title: null,
      department_id: 'dept-lab',
      standard_price: 150,
      default_duration_minutes: 15,
      booking_capacity: 10,
      requires_bed: false,
      requires_consent: false,
      requires_advance_deposit: false,
      minimum_advance_deposit_amount: null,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null,
      updated_by: null,
    };

    handleToggleLabTest(targetService);
  };

  const isItemSelected = (item: LabCatalogItem) => {
    if (!item.isConfigured || !isValidObjectId(item.id)) return false;
    return labOrders.some((o) => o.id === item.id);
  };

  const handleRemoveOrder = (localId: string) => {
    if (!canEdit) return;
    setLabOrders((prev) => prev.filter((o) => o.local_id !== localId));
  };

  return (
    <article className="oph-order-main-card">
      <div className="oph-order-layout-grid">
        {/* Left Column: Builder */}
        <div className="oph-order-builder">
          {/* Header */}
          <div className="oph-order-header">
            <div className="oph-order-header-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <OphthalmologyOrderIcon kind="clipboard" />
            </div>
            <div>
              <h3 className="oph-order-title">Laboratory orders</h3>
              <p className="oph-order-subtitle">Select tests for this patient.</p>
            </div>
            <span className="oph-order-status">{statusLabel}</span>
          </div>

          {/* Config Filter Bar (4 Columns) */}
          {canEdit && (
            <div className="oph-order-config-bar four">
              {/* Priority */}
              <div className="oph-order-field">
                <label htmlFor="oph-lab-priority-sel">Priority</label>
                <div className="oph-order-input-wrap">
                  <i className="ph ph-clock oph-order-field-icon" />
                  <select
                    id="oph-lab-priority-sel"
                    value={labPriority}
                    onChange={(e) => setLabPriority(e.target.value as ApiClinicalOrderPriority)}
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STAT">Stat</option>
                  </select>
                </div>
              </div>

              {/* Laboratory */}
              <div className="oph-order-field">
                <label htmlFor="oph-lab-facility-sel">Laboratory</label>
                <div className="oph-order-input-wrap">
                  <i className="ph ph-buildings oph-order-field-icon" />
                  <select
                    id="oph-lab-facility-sel"
                    value={labFacility}
                    onChange={(e) => setLabFacility(e.target.value)}
                  >
                    {labFacilities.map((facility) => (
                      <option key={facility} value={facility}>
                        {facility}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Type */}
              <div className="oph-order-field">
                <label htmlFor="oph-lab-sample-type-sel">Sample type</label>
                <div className="oph-order-input-wrap">
                  <i className="ph ph-drop oph-order-field-icon" />
                  <select
                    id="oph-lab-sample-type-sel"
                    value={labSampleType}
                    onChange={(e) => setLabSampleType(e.target.value)}
                  >
                    <option value="All Sample Types">All Sample Types</option>
                    {labSampleTypeOptions
                      .filter((st) => st !== 'All Sample Types')
                      .map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Category */}
              <div className="oph-order-field">
                <label htmlFor="oph-lab-category-sel">Category</label>
                <div className="oph-order-input-wrap">
                  <i className="ph ph-tag oph-order-field-icon" />
                  <select
                    id="oph-lab-category-sel"
                    value={labCategory}
                    onChange={(e) => setLabCategory(e.target.value)}
                  >
                    <option value="All Categories">All Categories</option>
                    {labCategoryOptions
                      .filter((c) => c !== 'All' && c !== 'All Categories')
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    <option value="Pre-Operative">Pre-Operative</option>
                    <option value="Commonly Used">Commonly Used</option>
                    <option value="Ocular & Vision Related">Ocular &amp; Vision Related</option>
                    <option value="Inflammatory & Autoimmune">Inflammatory &amp; Autoimmune</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Filter Chips + Search Row */}
          <div className="oph-order-filter-row">
            <div className="oph-order-chips" role="tablist">
              {[
                'All Tests',
                'Commonly Used',
                'Ocular & Vision Related',
                'Pre-Operative',
                'Inflammatory & Autoimmune',
              ].map((tab) => {
                const isActive = activeTabFilter === tab;
                const count = tabCounts[tab as keyof typeof tabCounts] ?? 0;
                return (
                  <button
                    key={tab}
                    type="button"
                    className={`oph-order-chip ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTabFilter(tab)}
                    role="tab"
                    aria-selected={isActive}
                  >
                    <span>{{ 'All Tests': 'All tests', 'Commonly Used': 'Commonly used', 'Ocular & Vision Related': 'Ocular & vision', 'Pre-Operative': 'Pre-operative', 'Inflammatory & Autoimmune': 'Inflammatory' }[tab]}</span>
                    <span className="oph-order-chip-badge">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="oph-order-search-box">
              <i className="ph ph-magnifying-glass" />
              <input
                type="text"
                placeholder="Search tests..."
                value={labSearchQuery}
                onChange={(e) => setLabSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Available Tests Heading */}
          <h4 className="oph-order-section-title">Available tests <span>{labOrders.length} selected</span></h4>

          {/* 3-Column Test Cards Grid */}
          <div className="oph-test-cards-grid">
            {filteredItems.length === 0 ? (
              <div className="oph-test-empty-box">
                No lab tests found matching current criteria.
              </div>
            ) : (
              filteredItems.map((item) => {
                const selected = isItemSelected(item);
                const starred = Boolean(starredMap[item.code] || starredMap[item.id]);
                const isConfigured = item.isConfigured && isValidObjectId(item.id);

                return (
                  <div
                    key={item.id}
                    className={`oph-test-card ${selected ? 'selected' : ''} ${!isConfigured ? 'unconfigured' : ''}`}
                    onClick={() => handleCardClick(item)}
                    role="checkbox"
                    aria-checked={selected}
                    aria-disabled={!isConfigured}
                    tabIndex={0}
                    style={!isConfigured ? { opacity: 0.72, borderStyle: 'dashed' } : undefined}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleCardClick(item);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      className="oph-test-checkbox"
                      checked={selected}
                      disabled={!canEdit || !isConfigured}
                      onChange={() => handleCardClick(item)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div
                      className="oph-test-icon-circle"
                      style={{ background: item.iconBg, color: item.iconColor }}
                    >
                      <OphthalmologyOrderIcon kind="activity" />
                    </div>
                    <div className="oph-test-body">
                      <div className="oph-test-name" title={item.name}>
                        {item.name}
                      </div>
                      <div className="oph-test-subtext">
                        <span>{item.sampleType}</span>
                        {!isConfigured && (
                          <span
                            style={{
                              marginLeft: '8px',
                              fontSize: '0.68rem',
                              color: '#b45309',
                              background: '#fef3c7',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              display: 'inline-block',
                            }}
                          >
                            Not Configured
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="oph-test-star-btn"
                      title={starred ? 'Starred' : 'Star test'}
                      onClick={(e) => toggleStar(e, item.code || item.id)}
                    >
                      <i
                        className={`ph ${starred ? 'ph-star-fill' : 'ph-star'}`}
                        style={{ color: starred ? '#f59e0b' : '#cbd5e1' }}
                      />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Clinical Notes & Instructions (2 Columns) */}
          <div className="oph-order-notes-grid">
            <div className="oph-order-note-col">
              <label htmlFor="oph-lab-clinical-notes">Clinical notes</label>
              <textarea
                id="oph-lab-clinical-notes"
                placeholder="e.g. Suspected infection, pre-operative clearance, or specific clinical concern..."
                value={labClinicalNotes}
                onChange={(e) => setLabClinicalNotes(e.target.value.slice(0, 500))}
                disabled={!canEdit}
                maxLength={500}
              />
              <div className="oph-char-counter">{labClinicalNotes.length}/500</div>
            </div>

            <div className="oph-order-note-col">
              <label htmlFor="oph-lab-order-summary">Order instructions</label>
              <textarea
                id="oph-lab-order-summary"
                placeholder="e.g. Fasting required, urgent processing, send copy to referring consultant..."
                value={labOrderSummary}
                onChange={(e) => setLabOrderSummary(e.target.value.slice(0, 500))}
                disabled={!canEdit}
                maxLength={500}
              />
              <div className="oph-char-counter">{labOrderSummary.length}/500</div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <aside className="oph-order-summary-panel">
          <div className="oph-summary-header">
            <i className="ph ph-shopping-cart" style={{ color: '#0284c7', fontSize: '1.15rem' }} />
            <span>Order summary</span><span className="oph-order-status">{labOrders.length}</span>
          </div>

          <div className="oph-summary-items-list">
            {labOrders.length === 0 ? (
              <div className="oph-summary-empty">
                <OphthalmologyOrderIcon kind="clipboard" />Select tests to build the order.
              </div>
            ) : (
              labOrders.map((order) => {
                // Find matching catalog item for icon and sample type
                const catItem = unifiedCatalog.find(
                  (c) => c.id === order.id || c.name.toLowerCase() === order.name.toLowerCase(),
                );
                const sampleType = catItem?.sampleType || labSampleType || 'Whole Blood / Serum / Plasma';
                const category = order.category || catItem?.category || 'Pre-Operative';

                return (
                  <div key={order.local_id} className="oph-summary-item-card">
                    <div className="oph-summary-item-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div
                          className="oph-test-icon-circle"
                          style={{
                            width: '24px',
                            height: '24px',
                            fontSize: '0.8rem',
                            background: catItem?.iconBg || '#e0f2fe',
                            color: catItem?.iconColor || '#0284c7',
                          }}
                        >
                          <i className={`ph ${catItem?.icon || 'ph-flask'}`} />
                        </div>
                        <div className="oph-summary-item-name" title={order.name}>
                          {order.name}
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          className="oph-summary-remove-btn"
                          title="Remove item"
                          onClick={() => handleRemoveOrder(order.local_id)}
                        >
                          <i className="ph ph-x" />
                        </button>
                      )}
                    </div>
                    <div className="oph-summary-item-detail">
                      <div>
                        <strong>Sample:</strong> {sampleType}
                      </div>
                      <div>
                        <strong>Category:</strong> {category}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <span className="oph-priority-pill">{labPriority.toLowerCase()}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="oph-order-review-note"><i className="ph ph-check" aria-hidden="true" />Review tests before submitting.</div>
        </aside>
      </div>

      {/* Footer Sticky/Action Bar */}
      <div className="oph-order-footer">
        <div className="oph-order-autosave">
          <i className="ph ph-check-circle-fill" />
          <span>Save changes before leaving</span>
        </div>

        <div className="oph-order-actions-group">
          {canEdit && (
            <button
              type="button"
              className="oph-order-btn-outline"
              onClick={saveConsultationDraft}
            >
              <i className="ph ph-floppy-disk" />
              <span>Save Draft</span>
            </button>
          )}

          <button
            type="button"
            className="oph-order-btn-outline"
            style={{ color: '#0284c7', borderColor: '#bae6fd' }}
            onClick={() => window.print()}
          >
            <i className="ph ph-printer" />
            <span>Print Laboratory Order</span>
          </button>

          {canEdit && handleSubmitLabOrder && (
            <button
              type="button"
              className="oph-order-btn-primary"
              style={{ background: '#0284c7', borderColor: '#0284c7' }}
              disabled={isSubmitting || labOrders.length === 0}
              onClick={handleSubmitLabOrder}
            >
              {isSubmitting ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <i className="ph ph-paper-plane-tilt" />
                  <span>Submit order ({labOrders.length})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
