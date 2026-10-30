import { useMemo, useState } from 'react';
import type { ApiClinicalOrderPriority } from '../../api/opd';
import type { ServiceResponse } from '../../api/services';
import type { ImagingOrderItem } from '../opd/OpdImagingSection';
import { MedicalSpinner } from '../ui/MedicalLoader';
import { OphthalmologyOrderIcon } from './OphthalmologyOrderIcon';

export type OphthalmologyImagingOrdersSectionProps = {
  imagingPriority: ApiClinicalOrderPriority;
  setImagingPriority: (val: ApiClinicalOrderPriority) => void;
  imagingCategory: string;
  setImagingCategory: (val: string) => void;
  imagingCategoryOptions: string[];
  availableImagingTests: ServiceResponse[];
  imagingOrders: ImagingOrderItem[];
  setImagingOrders: React.Dispatch<React.SetStateAction<ImagingOrderItem[]>>;
  handleToggleImagingTest: (test: ServiceResponse) => void;
  imagingSearchQuery: string;
  setImagingSearchQuery: (val: string) => void;
  imagingClinicalInfo: string;
  setImagingClinicalInfo: (val: string) => void;
  imagingOrderInstructions: string;
  setImagingOrderInstructions: (val: string) => void;
  saveConsultationDraft: () => void;
  handleNextStep: (tab: string) => void;
  handleSubmitImagingOrder?: () => void;
  isSubmitting?: boolean;
  canEdit: boolean;
  statusLabel?: string;
};

interface ImagingCatalogItem {
  id: string;
  code: string;
  name: string;
  category: string;
  modalityType: 'Ophthalmic Imaging' | 'Systemic Imaging';
  icon: string;
  iconBg: string;
  iconColor: string;
  defaultStarred?: boolean;
}

const DEFAULT_IMAGING_CATALOG: ImagingCatalogItem[] = [
  {
    id: 'img-cat-01',
    code: 'IMG-AS-OCT',
    name: 'Anterior Segment OCT (AS-OCT) — Iridocorneal Angle & Flap Assessment',
    category: 'Ophthalmic Tomography & Diagnostics',
    modalityType: 'Ophthalmic Imaging',
    icon: 'ph-target',
    iconBg: '#ffedd5',
    iconColor: '#ea580c',
    defaultStarred: true,
  },
  {
    id: 'img-cat-02',
    code: 'IMG-HUMPHREY-VF',
    name: 'Humphrey Automated Perimeter Visual Field Analysis',
    category: 'Perimetry & Neuro-Diagnostics',
    modalityType: 'Ophthalmic Imaging',
    icon: 'ph-squares-four',
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
  },
  {
    id: 'img-cat-03',
    code: 'IMG-PENTACAM-TOPO',
    name: 'Corneal Topography & Scheimpflug Tomography (Pentacam HR)',
    category: 'Corneal Diagnostic Imaging',
    modalityType: 'Ophthalmic Imaging',
    icon: 'ph-circle-dashed',
    iconBg: '#fee2e2',
    iconColor: '#ef4444',
  },
  {
    id: 'img-cat-04',
    code: 'IMG-BSCAN-USG',
    name: 'B-Scan Ophthalmic Diagnostic Ultrasonography',
    category: 'Ocular Ultrasound',
    modalityType: 'Ophthalmic Imaging',
    icon: 'ph-wave-sine',
    iconBg: '#f3e8ff',
    iconColor: '#9333ea',
  },
  {
    id: 'img-cat-05',
    code: 'IMG-FFA-RETINAL',
    name: 'Fundus Fluorescein Angiography (FFA) Dynamic Retinal Vascular Study',
    category: 'Retinal Angiography',
    modalityType: 'Systemic Imaging',
    icon: 'ph-file-magnifying-glass',
    iconBg: '#e0f2fe',
    iconColor: '#0284c7',
  },
];

export function OphthalmologyImagingOrdersSection({
  imagingPriority,
  setImagingPriority,
  imagingCategory,
  setImagingCategory,
  imagingCategoryOptions,
  availableImagingTests,
  imagingOrders,
  setImagingOrders,
  handleToggleImagingTest,
  imagingSearchQuery,
  setImagingSearchQuery,
  imagingClinicalInfo,
  setImagingClinicalInfo,
  imagingOrderInstructions,
  setImagingOrderInstructions,
  saveConsultationDraft,
  handleSubmitImagingOrder,
  isSubmitting,
  canEdit,
  statusLabel = 'Draft',
}: OphthalmologyImagingOrdersSectionProps) {
  // Category tabs filter state
  const [activeTabFilter, setActiveTabFilter] = useState<string>('All Scans');

  // Track starred items
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    DEFAULT_IMAGING_CATALOG.forEach((item) => {
      if (item.defaultStarred) init[item.id] = true;
    });
    return init;
  });

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarredMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Combine default catalog with available tests from database
  const unifiedCatalog = useMemo(() => {
    const list: ImagingCatalogItem[] = [...DEFAULT_IMAGING_CATALOG];
    availableImagingTests.forEach((dbSvc) => {
      const exists = list.some(
        (item) => item.id === dbSvc.id || item.name.toLowerCase() === dbSvc.name.toLowerCase(),
      );
      if (!exists) {
        list.push({
          id: dbSvc.id,
          code: dbSvc.code || `IMG-${dbSvc.id.slice(0, 4)}`,
          name: dbSvc.name,
          category: dbSvc.category || 'Ophthalmic Tomography & Diagnostics',
          modalityType: 'Ophthalmic Imaging',
          icon: 'ph-image',
          iconBg: '#f3e8ff',
          iconColor: '#7c3aed',
        });
      }
    });
    return list;
  }, [availableImagingTests]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const total = unifiedCatalog.length;
    const ophthalmic = unifiedCatalog.filter((item) => item.modalityType === 'Ophthalmic Imaging').length;
    const systemic = unifiedCatalog.filter((item) => item.modalityType === 'Systemic Imaging').length;

    return {
      'All Scans': total,
      'Ophthalmic Imaging': ophthalmic,
      'Systemic Imaging': systemic,
    };
  }, [unifiedCatalog]);

  // Filtered display items
  const filteredItems = useMemo(() => {
    return unifiedCatalog.filter((item) => {
      // Tab filter
      if (activeTabFilter === 'Ophthalmic Imaging' && item.modalityType !== 'Ophthalmic Imaging') {
        return false;
      }
      if (activeTabFilter === 'Systemic Imaging' && item.modalityType !== 'Systemic Imaging') {
        return false;
      }

      // Dropdown Category filter
      if (imagingCategory && imagingCategory !== 'Modalities' && imagingCategory !== 'All Modalities' && imagingCategory !== 'All') {
        const cat = imagingCategory.toLowerCase();
        if (!item.category.toLowerCase().includes(cat) && !item.modalityType.toLowerCase().includes(cat)) {
          return false;
        }
      }

      // Search Query filter
      if (imagingSearchQuery.trim()) {
        const q = imagingSearchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        if (!matchesName && !matchesCat) return false;
      }

      return true;
    });
  }, [unifiedCatalog, activeTabFilter, imagingCategory, imagingSearchQuery]);

  // Handle clicking on a card
  const handleCardClick = (item: ImagingCatalogItem) => {
    if (!canEdit) return;

    const matchedSvc = availableImagingTests.find(
      (s) => s.id === item.id || s.name.toLowerCase() === item.name.toLowerCase(),
    );

    const targetService: ServiceResponse = matchedSvc || {
      id: item.id,
      code: item.code,
      name: item.name,
      service_type: 'IMAGING_SERVICE',
      category: item.category,
      sample_type: null,
      description: item.name,
      reference_video_url: null,
      reference_video_title: null,
      department_id: 'dept-imaging',
      standard_price: 350,
      default_duration_minutes: 20,
      booking_capacity: 8,
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

    handleToggleImagingTest(targetService);
  };

  const isItemSelected = (item: ImagingCatalogItem) => {
    return imagingOrders.some((o) => o.id === item.id || o.name.toLowerCase() === item.name.toLowerCase());
  };

  const handleRemoveOrder = (localId: string) => {
    if (!canEdit) return;
    setImagingOrders((prev) => prev.filter((o) => o.local_id !== localId));
  };

  return (
    <article className="oph-order-main-card oph-imaging-orders">
      <div className="oph-order-layout-grid">
        {/* Left Column: Builder */}
        <div className="oph-order-builder">
          {/* Header */}
          <div className="oph-order-header">
            <div className="oph-order-header-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <OphthalmologyOrderIcon kind="activity" />
            </div>
            <div>
              <h3 className="oph-order-title">Imaging &amp; radiology requisition</h3>
              <p className="oph-order-subtitle">Order scans for this patient.</p>
            </div>
            <span className="oph-order-status">{statusLabel}</span>
          </div>

          {/* Config Filter Bar (2 Columns) */}
          {canEdit && (
            <div className="oph-order-config-bar two">
              {/* Priority */}
              <div className="oph-order-field">
                <label htmlFor="oph-imaging-priority-sel">Priority</label>
                <div className="oph-order-input-wrap">
                  <i className="ph ph-clock oph-order-field-icon" />
                  <select
                    id="oph-imaging-priority-sel"
                    value={imagingPriority}
                    onChange={(e) => setImagingPriority(e.target.value as ApiClinicalOrderPriority)}
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STAT">Stat</option>
                  </select>
                </div>
              </div>

              {/* Imaging Category */}
              <div className="oph-order-field">
                <label htmlFor="oph-imaging-category-sel">Imaging category</label>
                <div className="oph-order-input-wrap">
                  <i className="ph ph-squares-four oph-order-field-icon" />
                  <select
                    id="oph-imaging-category-sel"
                    value={imagingCategory}
                    onChange={(e) => setImagingCategory(e.target.value)}
                  >
                    <option value="Modalities">Modalities</option>
                    {imagingCategoryOptions
                      .filter((c) => c !== 'All' && c !== 'Modalities')
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    <option value="Ophthalmic Imaging">Ophthalmic Imaging</option>
                    <option value="Systemic Imaging">Systemic Imaging</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Filter Chips + Search Row */}
          <div className="oph-order-filter-row">
            <div className="oph-order-chips" role="tablist">
              {['All Scans', 'Ophthalmic Imaging', 'Systemic Imaging'].map((tab) => {
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
                    <span>{tab}</span>
                    <span className="oph-order-chip-badge">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="oph-order-search-box">
              <i className="ph ph-magnifying-glass" />
              <input
                type="text"
                placeholder="Search imaging scans..."
                value={imagingSearchQuery}
                onChange={(e) => setImagingSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Available Imaging Tests Heading */}
          <h4 className="oph-order-section-title">Available imaging tests <span>{imagingOrders.length} selected</span></h4>

          {/* 3-Column Imaging Cards Grid */}
          <div className="oph-test-cards-grid">
            {filteredItems.length === 0 ? (
              <div className="oph-test-empty-box">
                No imaging tests found matching current criteria.
              </div>
            ) : (
              filteredItems.map((item) => {
                const selected = isItemSelected(item);
                const starred = Boolean(starredMap[item.id]);

                return (
                  <div
                    key={item.id}
                    className={`oph-test-card ${selected ? 'selected' : ''}`}
                    onClick={() => handleCardClick(item)}
                    role="checkbox"
                    aria-checked={selected}
                    tabIndex={0}
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
                      disabled={!canEdit}
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
                      <div className="oph-test-subtext">{item.category}</div>
                    </div>
                    <button
                      type="button"
                      className="oph-test-star-btn"
                      title={starred ? 'Starred' : 'Star test'}
                      onClick={(e) => toggleStar(e, item.id)}
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

          {/* Clinical Information & Instructions (2 Columns) */}
          <div className="oph-order-notes-grid">
            <div className="oph-order-note-col">
              <label htmlFor="oph-img-clinical-info">Clinical information</label>
              <textarea
                id="oph-img-clinical-info"
                placeholder="Symptoms, suspected pathology, or trauma site..."
                value={imagingClinicalInfo}
                onChange={(e) => setImagingClinicalInfo(e.target.value.slice(0, 500))}
                disabled={!canEdit}
                maxLength={500}
              />
              <div className="oph-char-counter">{imagingClinicalInfo.length}/500</div>
            </div>

            <div className="oph-order-note-col">
              <label htmlFor="oph-img-order-instructions">Order instructions</label>
              <textarea
                id="oph-img-order-instructions"
                placeholder="Special views, contrast, or other instructions..."
                value={imagingOrderInstructions}
                onChange={(e) => setImagingOrderInstructions(e.target.value.slice(0, 500))}
                disabled={!canEdit}
                maxLength={500}
              />
              <div className="oph-char-counter">{imagingOrderInstructions.length}/500</div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <aside className="oph-order-summary-panel">
          <div className="oph-summary-header">
            <i className="ph ph-shopping-cart" style={{ color: '#0284c7', fontSize: '1.15rem' }} />
            <span>Order summary</span><span className="oph-order-status">{imagingOrders.length}</span>
          </div>

          <div className="oph-summary-items-list">
            {imagingOrders.length === 0 ? (
              <div className="oph-summary-empty">
                Select scans to build the order.
              </div>
            ) : (
              imagingOrders.map((order) => {
                const catItem = unifiedCatalog.find(
                  (c) => c.id === order.id || c.name.toLowerCase() === order.name.toLowerCase(),
                );
                const category = order.category || catItem?.category || 'Ophthalmic Tomography & Diagnostics';

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
                            background: catItem?.iconBg || '#ffedd5',
                            color: catItem?.iconColor || '#ea580c',
                          }}
                        >
                          <i className={`ph ${catItem?.icon || 'ph-image'}`} />
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
                        <strong>Category:</strong> {category}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <span className="oph-priority-pill">{imagingPriority.toLowerCase()}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="oph-order-review-note"><i className="ph ph-check" aria-hidden="true" />Review scans before submitting.</div>
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
            style={{ color: '#7c3aed', borderColor: '#ddd6fe' }}
            onClick={() => window.print()}
          >
            <i className="ph ph-printer" />
            <span>Print Imaging Order</span>
          </button>

          {canEdit && handleSubmitImagingOrder && (
            <button
              type="button"
              className="oph-order-btn-primary"
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
              disabled={isSubmitting || imagingOrders.length === 0}
              onClick={handleSubmitImagingOrder}
            >
              {isSubmitting ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <i className="ph ph-paper-plane-tilt" />
                  <span>Submit Imaging Order ({imagingOrders.length})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
