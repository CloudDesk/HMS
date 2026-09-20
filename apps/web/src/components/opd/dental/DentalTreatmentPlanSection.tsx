import React, { useMemo, useState } from 'react';
import type {
  DentalStageStatus,
  DentalTreatmentPlanItem,
  DentalTreatmentPriority,
  DentalTreatmentStageResponse,
  DentalTreatmentStatus,
  ToothFinding,
  DentalTreatmentQuotationResponse,
} from '../../../api/opd';
import type { ServiceResponse } from '../../../api/services';
import type {
  BillingInvoiceStatus,
  DentalTreatmentBillingState,
} from '../../../api/billing';
import { useCurrencyFormatter } from '../../../api/useSettings';
import {
  useAssignDoctorToDentalStage,
  useCreateDentalStage,
  useDeleteDentalStage,
  useDentalStages,
  useUpdateDentalStageStatus,
  useCancelDentalStageAppointment,
  useDentalStageAppointment,
  useEpisodeDentalQuotations,
  useCreateDentalQuotation,
  useSendDentalQuotation,
  useAcceptDentalQuotation,
  useRejectDentalQuotation,
  usePostponeDentalQuotation,
} from '../../../hooks/opd/useOpd';
import { useDoctorsList } from '../../../hooks/doctors/useDoctors';
import type { DoctorResponse } from '../../../api/doctors';
import {
  COMMON_DENTAL_PROCEDURES,
  PERMANENT_QUADRANTS,
  PRIMARY_QUADRANTS,
  TOOTH_NAMES,
  getToothName,
} from '../../../pages/dental-utils';
import { DentalStageScheduleModal } from './DentalStageScheduleModal';
import { DentalProstheticLabModal } from './DentalProstheticLabModal';
import { useEpisodeDentalLabOrders } from '../../../hooks/opd/useOpd';
import styles from './DentalExamination.module.css';

interface DentalTreatmentPlanSectionProps {
  items: DentalTreatmentPlanItem[];
  teeth: ToothFinding[];
  onChange: (items: DentalTreatmentPlanItem[]) => void;
  disabled?: boolean;
  /** Patient ID */
  patientId?: string | null;
  /** Active dental treatment episode ID */
  episodeId?: string | null;
  /** Dental department ID for doctor lookups */
  departmentId?: string | null;
  /** PROCEDURE-type services from HMS Service Catalogue for the dental department */
  departmentServices?: ServiceResponse[];
  billingStates?: DentalTreatmentBillingState[];
  billingStateLoading?: boolean;
  billingStateError?: string;
  canCreateInvoice?: boolean;
  billingBlockedByUnsavedChanges?: boolean;
  billingTreatmentItemPending?: string | null;
  onCreateInvoice?: (treatmentItemId: string) => Promise<void>;
  onOpenInvoice?: (invoiceId: string) => void;
}

export const DentalTreatmentPlanSection: React.FC<DentalTreatmentPlanSectionProps> = ({
  items,
  teeth,
  onChange,
  disabled = false,
  patientId = null,
  episodeId = null,
  departmentId = null,
  departmentServices = [],
  billingStates = [],
  billingStateLoading = false,
  billingStateError = '',
  canCreateInvoice = false,
  billingBlockedByUnsavedChanges = false,
  billingTreatmentItemPending = null,
  onCreateInvoice,
  onOpenInvoice,
}) => {
  const formatCurrency = useCurrencyFormatter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [toothNumber, setToothNumber] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [procedureName, setProcedureName] = useState<string>('');
  const [priority, setPriority] = useState<DentalTreatmentPriority>('ROUTINE');
  const [estimatedCost, setEstimatedCost] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Treatment Stages state
  const [expandedStageRows, setExpandedStageRows] = useState<Set<string>>(new Set());
  const [addingStageForItem, setAddingStageForItem] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDoctorId, setNewStageDoctorId] = useState('');
  const [newStageNotes, setNewStageNotes] = useState('');
  const [newStagePlannedDate, setNewStagePlannedDate] = useState('');

  // Lab Order modal state
  const [labOrderCreateStage, setLabOrderCreateStage] = useState<DentalTreatmentStageResponse | null>(null);
  const [viewLabOrderId, setViewLabOrderId] = useState<string | null>(null);
  const { data: episodeLabOrders = [] } = useEpisodeDentalLabOrders(episodeId);

  // Scheduling modal state
  const [scheduleModalStage, setScheduleModalStage] = useState<DentalTreatmentStageResponse | null>(null);
  const [cancelConfirmStageId, setCancelConfirmStageId] = useState<string | null>(null);
  const [viewAppointmentStageId, setViewAppointmentStageId] = useState<string | null>(null);

  // Queries & Mutations
  const { data: allStages = [] } = useDentalStages(episodeId);
  const { data: stageAppointmentData, isLoading: stageAppointmentLoading } = useDentalStageAppointment(viewAppointmentStageId);
  const { data: doctorsData } = useDoctorsList(departmentId ? { department_id: departmentId } : {});
  const doctors: DoctorResponse[] = useMemo(() => doctorsData?.data ?? [], [doctorsData]);

  const createStageMutation = useCreateDentalStage();
  const assignDoctorMutation = useAssignDoctorToDentalStage();
  const updateStageStatusMutation = useUpdateDentalStageStatus();
  const deleteStageMutation = useDeleteDentalStage(episodeId ?? undefined);
  const cancelAppointmentMutation = useCancelDentalStageAppointment();

  // Quotation state & queries
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<DentalTreatmentQuotationResponse | null>(null);
  const [quoteNotes, setQuoteNotes] = useState<string>('');
  const [quoteValidUntil, setQuoteValidUntil] = useState<string>('');

  type OptionDraftItem = {
    id: string;
    treatment_plan_item_id?: string;
    service_id?: string;
    procedure_name: string;
    tooth_number?: number | null;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
    tax_amount?: number;
  };

  type OptionDraft = {
    id: string;
    name: string;
    description: string;
    discount_amount: string;
    tax_amount: string;
    items: OptionDraftItem[];
  };

  const [quoteOptions, setQuoteOptions] = useState<OptionDraft[]>([]);

  const { data: episodeQuotations = [], isLoading: quotationsLoading } = useEpisodeDentalQuotations(episodeId);
  const createQuotationMutation = useCreateDentalQuotation();
  const sendQuotationMutation = useSendDentalQuotation();
  const acceptQuotationMutation = useAcceptDentalQuotation();
  const rejectQuotationMutation = useRejectDentalQuotation();
  const postponeQuotationMutation = usePostponeDentalQuotation();

  const [selectedDecisionOptionId, setSelectedDecisionOptionId] = useState<string>('');
  const [decisionReasonInput, setDecisionReasonInput] = useState<string>('');
  const [decisionMode, setDecisionMode] = useState<'view' | 'reject' | 'postpone'>('view');

  const handleOpenQuotationModal = () => {
    const defaultOptionItems: OptionDraftItem[] = items.map((it, idx) => {
      const matchedSvc = departmentServices.find(
        (s) => s.id === it.service_id || s.name.toLowerCase() === it.procedure_name.toLowerCase(),
      );
      const price = matchedSvc ? matchedSvc.standard_price : (it.estimated_cost ?? 0);
      return {
        id: `opt-item-${idx}-${Date.now()}`,
        treatment_plan_item_id: it.id ?? undefined,
        service_id: it.service_id || matchedSvc?.id || undefined,
        procedure_name: it.procedure_name,
        tooth_number: it.tooth_number ?? null,
        quantity: 1,
        unit_price: price,
      };
    });

    setQuoteOptions([
      {
        id: `opt-1-${Date.now()}`,
        name: 'Option A – Recommended',
        description: 'Comprehensive restorative treatment plan',
        discount_amount: '0',
        tax_amount: '0',
        items: defaultOptionItems.length > 0 ? defaultOptionItems : [
          {
            id: `opt-item-0-${Date.now()}`,
            procedure_name: 'Consultation & Procedure',
            tooth_number: null,
            quantity: 1,
            unit_price: 0,
          },
        ],
      },
    ]);
    setQuoteNotes('');
    setQuoteValidUntil('');
    setShowQuotationModal(true);
  };

  const handleAddOption = () => {
    const nextLetter = String.fromCharCode(65 + quoteOptions.length); // A, B, C...
    setQuoteOptions((prev) => [
      ...prev,
      {
        id: `opt-${prev.length + 1}-${Date.now()}`,
        name: `Option ${nextLetter} – Alternative`,
        description: '',
        discount_amount: '0',
        tax_amount: '0',
        items: [
          {
            id: `opt-item-${Date.now()}`,
            procedure_name: '',
            tooth_number: null,
            quantity: 1,
            unit_price: 0,
          },
        ],
      },
    ]);
  };

  const handleRemoveOption = (optId: string) => {
    if (quoteOptions.length <= 1) return;
    setQuoteOptions((prev) => prev.filter((o) => o.id !== optId));
  };

  const handleOptionChange = (optId: string, field: keyof OptionDraft, value: string) => {
    setQuoteOptions((prev) =>
      prev.map((opt) => (opt.id === optId ? { ...opt, [field]: value } : opt)),
    );
  };

  const handleAddOptionItem = (optId: string) => {
    setQuoteOptions((prev) =>
      prev.map((opt) => {
        if (opt.id !== optId) return opt;
        return {
          ...opt,
          items: [
            ...opt.items,
            {
              id: `opt-item-${Date.now()}-${Math.random()}`,
              procedure_name: '',
              tooth_number: null,
              quantity: 1,
              unit_price: 0,
            },
          ],
        };
      }),
    );
  };

  const handleRemoveOptionItem = (optId: string, itemId: string) => {
    setQuoteOptions((prev) =>
      prev.map((opt) => {
        if (opt.id !== optId) return opt;
        if (opt.items.length <= 1) return opt;
        return {
          ...opt,
          items: opt.items.filter((it) => it.id !== itemId),
        };
      }),
    );
  };

  const handleOptionItemChange = (
    optId: string,
    itemId: string,
    field: keyof OptionDraftItem,
    value: string | number | null,
  ) => {
    setQuoteOptions((prev) =>
      prev.map((opt) => {
        if (opt.id !== optId) return opt;
        return {
          ...opt,
          items: opt.items.map((it) => {
            if (it.id !== itemId) return it;
            return { ...it, [field]: value };
          }),
        };
      }),
    );
  };

  // Group stages by planItemId
  const stagesByPlanItem = useMemo(() => {
    const map = new Map<string, DentalTreatmentStageResponse[]>();
    for (const stage of allStages) {
      const existing = map.get(stage.plan_item_id) ?? [];
      existing.push(stage);
      map.set(stage.plan_item_id, existing);
    }
    return map;
  }, [allStages]);

  const toggleStageRow = (itemId: string) => {
    setExpandedStageRows((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleOpenAddStage = (itemId: string) => {
    setAddingStageForItem(itemId);
    setNewStageName('');
    setNewStageNotes('');
    setNewStagePlannedDate('');
    if (doctors?.[0]) {
      setNewStageDoctorId(doctors[0].id);
    }
    if (!expandedStageRows.has(itemId)) {
      setExpandedStageRows((prev) => new Set(prev).add(itemId));
    }
  };

  const handleCancelAddStage = () => {
    setAddingStageForItem(null);
    setNewStageName('');
    setNewStageDoctorId('');
    setNewStageNotes('');
    setNewStagePlannedDate('');
  };

  const handleSaveStage = async (planItemId: string, toothNum?: number | null, serviceId?: string | null) => {
    if (!episodeId || !newStageName.trim() || !newStageDoctorId) return;

    const activeLabOrder = episodeLabOrders.find(
      (lo) => lo.treatment_plan_item_id === planItemId && lo.status !== 'CANCELLED',
    );

    await createStageMutation.mutateAsync({
      episodeId,
      payload: {
        plan_item_id: planItemId,
        stage_name: newStageName.trim(),
        assigned_doctor_id: newStageDoctorId,
        tooth_number: toothNum ?? null,
        service_id: serviceId ?? null,
        planned_date: newStagePlannedDate || null,
        prosthetic_lab_order_id: activeLabOrder?.id ?? null,
        notes: newStageNotes.trim() || null,
      },
    });

    handleCancelAddStage();
  };

  const urgentCount = useMemo(() => {
    return items.filter((it) => it.priority === 'URGENT' || it.priority === 'HIGH').length;
  }, [items]);

  const examinedTeethNumbers = useMemo(() => {
    return teeth.map((t) => t.tooth_number);
  }, [teeth]);

  const handleSelectService = (service: ServiceResponse) => {
    if (disabled) return;
    setSelectedServiceId(service.id);
    setProcedureName(service.name);
    if (service.standard_price >= 0) {
      setEstimatedCost(service.standard_price.toString());
    }
  };

  const handleCatalogueDropdownChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    if (!serviceId) return;
    const svc = departmentServices.find((s) => s.id === serviceId);
    if (svc) {
      setProcedureName(svc.name);
      if (svc.standard_price >= 0) {
        setEstimatedCost(svc.standard_price.toString());
      }
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || !procedureName.trim()) return;

    const newItem: DentalTreatmentPlanItem = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      service_id: selectedServiceId || null,
      tooth_number: toothNumber ? Number(toothNumber) : null,
      procedure_name: procedureName.trim(),
      surfaces: [],
      priority,
      estimated_cost: estimatedCost !== '' && !isNaN(Number(estimatedCost)) ? Number(estimatedCost) : null,
      notes: notes.trim() || null,
      status: 'PROPOSED',
    };

    onChange([...items, newItem]);

    // Reset inputs
    setToothNumber('');
    setSelectedServiceId('');
    setProcedureName('');
    setPriority('ROUTINE');
    setEstimatedCost('');
    setNotes('');
  };

  const handleRemoveItem = (index: number) => {
    if (disabled) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const handleStatusChange = (index: number, newStatus: DentalTreatmentStatus) => {
    if (disabled) return;
    const updated = items.map((item, i) => (i === index ? { ...item, status: newStatus } : item));
    onChange(updated);
  };

  // Financial summary calculations
  const totalCost = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.estimated_cost ?? 0), 0);
  }, [items]);

  const acceptedOrActiveCost = useMemo(() => {
    return items
      .filter((it) => it.status === 'ACCEPTED' || it.status === 'IN_PROGRESS' || it.status === 'COMPLETED')
      .reduce((acc, it) => acc + (it.estimated_cost ?? 0), 0);
  }, [items]);

  const billingStateByTreatmentItem = useMemo(
    () => new Map(billingStates.map((state) => [state.treatment_item_id, state])),
    [billingStates],
  );

  const billingLabel = (status: BillingInvoiceStatus) => {
    if (status === 'DRAFT') return 'Invoice draft';
    if (status === 'PENDING') return 'Invoice pending';
    if (status === 'PARTIALLY_PAID') return 'Partially paid';
    if (status === 'PAID') return 'Paid';
    return 'Invoice cancelled';
  };

  const getStatusBadgeStyle = (status: string | undefined) => {
    switch (status) {
      case 'ACCEPTED':
        return { background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' };
      case 'IN_PROGRESS':
        return { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' };
      case 'COMPLETED':
        return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
      case 'DECLINED':
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
      case 'CANCELLED':
        return { background: '#ffe4e6', color: '#9f1239', border: '1px solid #fecdd3' };
      case 'PROPOSED':
      default:
        return { background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' };
    }
  };

  const getStageStatusBadgeStyle = (status: DentalStageStatus) => {
    switch (status) {
      case 'COMPLETED':
        return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
      case 'IN_PROGRESS':
        return { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' };
      case 'SCHEDULED':
        return { background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' };
      case 'ON_HOLD':
        return { background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' };
      case 'CANCELLED':
        return { background: '#ffe4e6', color: '#9f1239', border: '1px solid #fecdd3' };
      case 'PLANNED':
      default:
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
    }
  };

  return (
    <>
    <div className={`${styles.card} ${styles.treatmentPlanCard}`}>
      <div
        className={`${styles.cardHeader} ${styles.cardHeaderCollapsible}`}
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={styles.collapseToggleBtn}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            aria-label={isExpanded ? 'Collapse Treatment Plan' : 'Expand Treatment Plan'}
          >
            <i className={`ph ph-caret-down ${styles.collapseChevron} ${isExpanded ? styles.collapseChevronExpanded : ''}`} />
          </button>
          <h3 className={styles.cardTitle}>
            <i className="ph ph-calendar-check" style={{ color: '#7c3aed' }} />
            Proposed Dental Treatment Plan &amp; Procedures
          </h3>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            ({items.length} Procedure{items.length === 1 ? '' : 's'})
          </span>
        </div>

        {items.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem' }}>
            <span style={{ color: '#475569' }}>
              Active/Accepted Value: <strong style={{ color: '#166534' }}>{formatCurrency(acceptedOrActiveCost)}</strong>
            </span>
            <span style={{ color: '#475569' }}>
              Total Plan Value: <strong style={{ color: '#1e40af' }}>{formatCurrency(totalCost)}</strong>
            </span>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className={styles.cardContent}>
          {billingStateError ? (
            <div className={styles.billingError} role="alert">
              <i className="ph ph-warning-circle" /> {billingStateError}
            </div>
          ) : null}

          {/* KPI Summary Cards */}
          <div className={styles.treatmentKpiGrid}>
            <div className={`${styles.treatmentKpiCard} ${styles.kpiCardBlue}`}>
              <div className={styles.treatmentKpiIconWrapper}>
                <i className="ph ph-calendar-check" />
              </div>
              <div className={styles.treatmentKpiContent}>
                <span className={styles.treatmentKpiLabel}>Planned Procedures</span>
                <span className={styles.treatmentKpiValue}>{items.length}</span>
                <span className={styles.treatmentKpiSubtext}>
                  {items.filter((i) => i.status === 'COMPLETED').length} Completed &middot; {items.filter((i) => i.status === 'ACCEPTED').length} Accepted
                </span>
              </div>
            </div>

            <div className={`${styles.treatmentKpiCard} ${styles.kpiCardEmerald}`}>
              <div className={styles.treatmentKpiIconWrapper}>
                <i className="ph ph-receipt" />
              </div>
              <div className={styles.treatmentKpiContent}>
                <span className={styles.treatmentKpiLabel}>Estimated Total</span>
                <span className={styles.treatmentKpiValue}>{formatCurrency(totalCost)}</span>
                <span className={styles.treatmentKpiSubtext}>
                  Active: {formatCurrency(acceptedOrActiveCost)}
                </span>
              </div>
            </div>

            <div className={`${styles.treatmentKpiCard} ${urgentCount > 0 ? styles.kpiCardRed : styles.kpiCardAmber}`}>
              <div className={styles.treatmentKpiIconWrapper}>
                <i className={urgentCount > 0 ? 'ph ph-warning' : 'ph ph-clock'} />
              </div>
              <div className={styles.treatmentKpiContent}>
                <span className={styles.treatmentKpiLabel}>Urgent Procedures</span>
                <span className={styles.treatmentKpiValue} style={urgentCount > 0 ? { color: '#dc2626' } : undefined}>
                  {urgentCount}
                </span>
                <span className={styles.treatmentKpiSubtext}>
                  {urgentCount > 0 ? 'Requires priority clinical attention' : 'Standard clinical schedule'}
                </span>
              </div>
            </div>
          </div>

          {/* Planned Items Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.treatmentTable}>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Site / Tooth</th>
                  <th>Procedure Name &amp; Multi-Doctor Stages</th>
                  <th style={{ width: '100px' }}>Priority</th>
                  <th style={{ width: '110px' }}>Est. Cost</th>
                  <th style={{ width: '140px' }}>Status</th>
                  <th>Clinical Notes</th>
                  <th style={{ minWidth: '170px' }}>Billing</th>
                  {!disabled && <th style={{ width: '60px', textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={disabled ? 7 : 8} className={styles.emptyStateText}>
                      No planned dental procedures recorded. Select procedures from the Service Catalogue or enter custom treatment items below.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const billingState = item.id ? billingStateByTreatmentItem.get(item.id) : undefined;
                    const cataloguePrice = item.service_id
                      ? departmentServices.find((service) => service.id === item.service_id)?.standard_price
                      : undefined;
                    const isPersisted = Boolean(item.id && /^[a-f\d]{24}$/i.test(item.id));
                    const isStatusBillable = item.status !== 'DECLINED' && item.status !== 'CANCELLED';
                    const isBillingThisItem = billingTreatmentItemPending === item.id;

                    const itemStages = (item.id ? stagesByPlanItem.get(item.id) : undefined) ?? [];
                    const isStagesExpanded = Boolean(item.id && expandedStageRows.has(item.id));
                    const isAddingStage = Boolean(item.id && addingStageForItem === item.id);

                    return (
                      <React.Fragment key={item.id ?? `plan-item-${idx}`}>
                        <tr>
                          <td style={{ fontWeight: 700, color: '#1e40af' }}>
                            {item.tooth_number ? (
                              <span
                                style={{
                                  background: '#dbeafe',
                                  color: '#1e40af',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  fontSize: '0.75rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <i className="ph-fill ph-tooth" style={{ fontSize: '0.8rem' }} /> #{item.tooth_number}
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  fontSize: '0.75rem',
                                }}
                              >
                                General
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600 }}>{item.procedure_name}</span>
                              {item.service_id && (
                                <span
                                  style={{
                                    fontSize: '0.675rem',
                                    color: '#0284c7',
                                    background: '#e0f2fe',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    fontWeight: 600,
                                  }}
                                >
                                  Catalogue
                                </span>
                              )}
                              {episodeId && isPersisted && (
                                <button
                                  type="button"
                                  className={styles.chip}
                                  style={{
                                    cursor: 'pointer',
                                    fontSize: '0.725rem',
                                    background: itemStages.length > 0 ? '#eff6ff' : '#f8fafc',
                                    color: itemStages.length > 0 ? '#1d4ed8' : '#64748b',
                                    borderColor: itemStages.length > 0 ? '#bfdbfe' : '#e2e8f0',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 8px',
                                  }}
                                  onClick={() => item.id && toggleStageRow(item.id)}
                                  title="Toggle sequential treatment stages"
                                >
                                  <i className="ph ph-git-merge" />
                                  Stages ({itemStages.length})
                                  <i className={`ph ph-caret-down ${isStagesExpanded ? styles.collapseChevronExpanded : ''}`} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                background:
                                  item.priority === 'URGENT' || item.priority === 'HIGH'
                                    ? '#fee2e2'
                                    : item.priority === 'ELECTIVE' || item.priority === 'LOW'
                                    ? '#f3e8ff'
                                    : '#dbeafe',
                                color:
                                  item.priority === 'URGENT' || item.priority === 'HIGH'
                                    ? '#dc2626'
                                    : item.priority === 'ELECTIVE' || item.priority === 'LOW'
                                    ? '#7e22ce'
                                    : '#1d4ed8',
                              }}
                            >
                              {item.priority ?? 'ROUTINE'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {cataloguePrice != null
                              ? formatCurrency(cataloguePrice)
                              : item.estimated_cost != null
                              ? formatCurrency(item.estimated_cost)
                              : '—'}
                          </td>
                          <td>
                            {disabled ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  ...getStatusBadgeStyle(item.status),
                                }}
                              >
                                {item.status ?? 'PROPOSED'}
                              </span>
                            ) : (
                              <select
                                className={styles.select}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.775rem',
                                  fontWeight: 600,
                                  borderRadius: '4px',
                                  ...getStatusBadgeStyle(item.status),
                                }}
                                value={item.status ?? 'PROPOSED'}
                                onChange={(e) => handleStatusChange(idx, e.target.value as DentalTreatmentStatus)}
                              >
                                <option value="PROPOSED">Proposed</option>
                                <option value="ACCEPTED">Accepted</option>
                                <option value="IN_PROGRESS">In-Progress</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="DECLINED">Declined</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>
                            )}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.notes ?? '—'}</td>
                          <td>
                            {billingState ? (
                              <div className={styles.billingCell}>
                                <span
                                  className={`${styles.billingBadge} ${
                                    billingState.invoice_status === 'PAID'
                                      ? styles.billingBadgePaid
                                      : billingState.invoice_status === 'CANCELLED'
                                      ? styles.billingBadgeCancelled
                                      : styles.billingBadgePending
                                  }`}
                                >
                                  {billingLabel(billingState.invoice_status)}
                                </span>
                                <button
                                  type="button"
                                  className={styles.billingLink}
                                  onClick={() => onOpenInvoice?.(billingState.invoice_id)}
                                >
                                  {billingState.invoice_number}
                                </button>
                                <small>{formatCurrency(billingState.unit_price)}</small>
                              </div>
                            ) : billingStateLoading ? (
                              <span className={styles.billingMuted}>Checking billing…</span>
                            ) : !item.service_id ? (
                              <span className={styles.billingMuted}>Clinical plan only</span>
                            ) : !isStatusBillable ? (
                              <span className={styles.billingMuted}>Not billable</span>
                            ) : billingBlockedByUnsavedChanges || !isPersisted ? (
                              <span className={styles.billingMuted}>Save before billing</span>
                            ) : canCreateInvoice && onCreateInvoice ? (
                              <button
                                type="button"
                                className={styles.btnBilling}
                                disabled={Boolean(billingTreatmentItemPending)}
                                onClick={() => {
                                  if (!item.id) return;
                                  void onCreateInvoice(item.id).catch(() => undefined);
                                }}
                              >
                                <i className="ph ph-receipt" />
                                {isBillingThisItem ? 'Creating…' : 'Create Invoice'}
                              </button>
                            ) : (
                              <span className={styles.billingMuted}>Not billed</span>
                            )}
                          </td>
                          {!disabled && (
                            <td style={{ textAlign: 'center' }}>
                              {billingState ? (
                                <span className={styles.billingMuted}>Invoice linked</span>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.btnSecondary}
                                  style={{ padding: '2px 6px', color: '#dc2626', borderColor: '#fecaca' }}
                                  onClick={() => handleRemoveItem(idx)}
                                  title="Remove procedure"
                                >
                                  <i className="ph ph-trash" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Nested Multi-Doctor Stages Drawer */}
                        {isStagesExpanded && item.id && (
                          <tr>
                            <td colSpan={disabled ? 7 : 8} style={{ padding: 0 }}>
                              <div className={styles.stagesDrawer}>
                                <div className={styles.stagesHeader}>
                                  <div className={styles.stagesHeaderTitle}>
                                    <i className="ph ph-git-commit" style={{ color: '#2563eb' }} />
                                    Treatment Stages &amp; Multi-Doctor Care
                                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>
                                      ({itemStages.length} stage{itemStages.length === 1 ? '' : 's'} assigned)
                                    </span>
                                  </div>
                                  {!disabled && (
                                    <button
                                      type="button"
                                      className={styles.btnSecondary}
                                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                      onClick={() => handleOpenAddStage(item.id!)}
                                    >
                                      <i className="ph ph-plus" /> Add Stage
                                    </button>
                                  )}
                                </div>

                                {itemStages.length === 0 && !isAddingStage && (
                                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', padding: '6px 0' }}>
                                    No stages defined yet. Break this procedure down into multi-doctor stages (e.g. Stage 1 RCT by Endodontist, Stage 2 Crown Impression by Prosthodontist).
                                  </div>
                                )}

                                <div className={styles.stagesTimeline}>
                                  {itemStages.map((stage) => {
                                    const stageLabOrder = episodeLabOrders.find(
                                      (lo) =>
                                        lo.treatment_stage_id === stage.id ||
                                        (stage.prosthetic_lab_order_id && lo.id === stage.prosthetic_lab_order_id)
                                    );
                                    const effectiveLabOrder =
                                      stageLabOrder ||
                                      episodeLabOrders.find(
                                        (lo) =>
                                          lo.treatment_plan_item_id &&
                                          lo.treatment_plan_item_id === stage.plan_item_id &&
                                          lo.status !== 'CANCELLED'
                                      );
                                    const isLabOrderPending = Boolean(
                                      effectiveLabOrder &&
                                        effectiveLabOrder.status !== 'READY' &&
                                        effectiveLabOrder.status !== 'CANCELLED'
                                    );
                                    const isLabOrderReady = Boolean(
                                      effectiveLabOrder && effectiveLabOrder.status === 'READY'
                                    );

                                    const nextFittingStage = itemStages.find(
                                      (s) => s.sequence > stage.sequence && s.status !== 'CANCELLED'
                                    );

                                    // Check if prior non-cancelled stages are completed
                                    const priorIncomplete = itemStages
                                      .filter((s) => s.sequence < stage.sequence && s.status !== 'CANCELLED')
                                      .some((s) => s.status !== 'COMPLETED');

                                    const isCompleted = stage.status === 'COMPLETED';
                                    const isInProgress = stage.status === 'IN_PROGRESS';

                                    return (
                                      <div
                                        key={stage.id}
                                        className={`${styles.stageCard} ${
                                          isCompleted
                                            ? styles.stageCardCompleted
                                            : isInProgress
                                            ? styles.stageCardInProgress
                                            : ''
                                        }`}
                                      >
                                        <div className={styles.stageMain}>
                                          <div
                                            className={`${styles.stageSequence} ${
                                              isCompleted
                                                ? styles.stageSequenceCompleted
                                                : isInProgress
                                                ? styles.stageSequenceInProgress
                                                : ''
                                            }`}
                                          >
                                            {isCompleted ? '✓' : stage.sequence}
                                          </div>
                                          <div className={styles.stageDetails}>
                                            <div className={styles.stageName}>
                                              Stage {stage.sequence}: {stage.stage_name}
                                            </div>
                                            <div className={styles.stageMeta}>
                                              <span className={styles.stageDoctorChip}>
                                                <i className="ph ph-stethoscope" style={{ color: '#2563eb' }} />
                                                Dr. {stage.assigned_doctor_name}
                                              </span>
                                              {stage.notes && <span>{stage.notes}</span>}
                                              {stage.completed_at && (
                                                <span style={{ color: '#166534' }}>
                                                  Completed on {new Date(stage.completed_at).toLocaleDateString()}
                                                </span>
                                              )}
                                            </div>

                                            {/* Phase 5D & Phase 7A: Lab READY banner */}
                                            {isLabOrderReady && effectiveLabOrder && (
                                              <div className={styles.stageLabReadyBanner} data-testid="stage-lab-ready-banner">
                                                <i className="ph-fill ph-check-circle" style={{ color: '#16a34a', fontSize: '1.1rem', flexShrink: 0 }} />
                                                <div style={{ flex: 1 }}>
                                                  <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>
                                                    <strong>Prosthetic Ready:</strong> {effectiveLabOrder.prosthetic_type}
                                                    {effectiveLabOrder.tooth_number ? ` – Tooth #${effectiveLabOrder.tooth_number}` : ''} ({effectiveLabOrder.order_number}) is ready for clinical fitting &amp; cementation.
                                                  </div>
                                                  <div style={{ fontSize: '0.725rem', color: '#15803d', marginTop: '2px' }}>
                                                    <strong>Next Clinical Step:</strong>{' '}
                                                    {nextFittingStage
                                                      ? `Stage ${nextFittingStage.sequence}: ${nextFittingStage.stage_name}`
                                                      : 'Fitting / Cementation'}
                                                  </div>
                                                </div>
                                                {effectiveLabOrder.ready_at && (
                                                  <small style={{ color: '#15803d', marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                    Ready {new Date(effectiveLabOrder.ready_at).toLocaleDateString()}
                                                  </small>
                                                )}
                                              </div>
                                            )}

                                            {/* Phase 5D: Lab Pending banner */}
                                            {isLabOrderPending && effectiveLabOrder && (
                                              <div className={styles.stageLabPendingBanner} data-testid="stage-lab-pending-banner">
                                                <i className="ph ph-hourglass-high" style={{ color: '#d97706', fontSize: '1rem' }} />
                                                <span style={{ fontSize: '0.75rem', color: '#92400e' }}>
                                                  <strong>Lab Processing:</strong> {effectiveLabOrder.prosthetic_type} ({effectiveLabOrder.order_number}) is currently <strong>{effectiveLabOrder.status.replace('_', ' ')}</strong>. Awaiting READY before clinical completion.
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className={styles.stageActionsArea}>
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '3px',
                                              padding: '2px 7px',
                                              borderRadius: '4px',
                                              fontSize: '0.725rem',
                                              fontWeight: 700,
                                              ...getStageStatusBadgeStyle(stage.status),
                                            }}
                                          >
                                            {stage.status}
                                          </span>

                                          {/* Lab Order Badge / Trigger */}
                                          {stageLabOrder ? (
                                            <span
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '2px 7px',
                                                borderRadius: '4px',
                                                fontSize: '0.725rem',
                                                fontWeight: 600,
                                                background:
                                                  stageLabOrder.status === 'READY'
                                                    ? '#dcfce7'
                                                    : stageLabOrder.status === 'CANCELLED'
                                                    ? '#fef2f2'
                                                    : '#f5f3ff',
                                                color:
                                                  stageLabOrder.status === 'READY'
                                                    ? '#166534'
                                                    : stageLabOrder.status === 'CANCELLED'
                                                    ? '#dc2626'
                                                    : '#6d28d9',
                                                border: `1px solid ${
                                                  stageLabOrder.status === 'READY'
                                                    ? '#86efac'
                                                    : stageLabOrder.status === 'CANCELLED'
                                                    ? '#fecaca'
                                                    : '#ddd6fe'
                                                }`,
                                              }}
                                              data-testid="stage-lab-order-badge"
                                            >
                                              <i className="ph ph-wrench" />
                                              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{stageLabOrder.order_number}</span>
                                              <span>• {stageLabOrder.prosthetic_type}</span>
                                              {stageLabOrder.status !== 'ORDERED' && (
                                                <span style={{ fontSize: '0.675rem', fontWeight: 700, opacity: 0.9 }}>
                                                  [{stageLabOrder.status}]
                                                </span>
                                              )}
                                              <button
                                                type="button"
                                                style={{
                                                  background: 'transparent',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                  color: stageLabOrder.status === 'READY' ? '#166534' : '#5b21b6',
                                                  padding: '0 2px',
                                                  marginLeft: '2px',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                }}
                                                onClick={() => setViewLabOrderId(stageLabOrder.id)}
                                                title="View Prosthetic Lab Order"
                                              >
                                                <i className="ph ph-eye" />
                                              </button>
                                            </span>
                                          ) : (
                                            !disabled && !isCompleted && stage.status !== 'CANCELLED' && (
                                              <button
                                                type="button"
                                                className={styles.btnStageAction}
                                                style={{ background: '#fdf4ff', color: '#a21caf', borderColor: '#f0abfc' }}
                                                onClick={() => setLabOrderCreateStage(stage)}
                                                title="Create Prosthetic Lab Order for this stage"
                                                data-testid="stage-create-lab-order-btn"
                                              >
                                                <i className="ph ph-wrench" /> Lab Order
                                              </button>
                                            )
                                          )}

                                          {!disabled && !isCompleted && stage.status !== 'CANCELLED' && (
                                            <>
                                              {(stage.status === 'PLANNED' || stage.status === 'SCHEDULED') && (
                                                <button
                                                  type="button"
                                                  className={`${styles.btnStageAction} ${styles.btnStageStart}`}
                                                  disabled={priorIncomplete || isLabOrderPending}
                                                  onClick={() =>
                                                    updateStageStatusMutation.mutate({
                                                      stageId: stage.id,
                                                      payload: { status: 'IN_PROGRESS' },
                                                    })
                                                  }
                                                  title={
                                                    priorIncomplete
                                                      ? 'Previous stage must be completed first'
                                                      : isLabOrderPending
                                                      ? `Prosthetic lab order (${stageLabOrder?.order_number}) is ${stageLabOrder?.status}. Must be READY before starting stage.`
                                                      : 'Start stage'
                                                  }
                                                  data-testid={`stage-${stage.sequence}-start-btn`}
                                                >
                                                  <i className="ph ph-play" /> Start
                                                </button>
                                              )}

                                              {stage.status === 'IN_PROGRESS' && (
                                                <>
                                                  <button
                                                    type="button"
                                                    className={`${styles.btnStageAction} ${styles.btnStageComplete}`}
                                                    disabled={priorIncomplete || isLabOrderPending}
                                                    onClick={() =>
                                                      updateStageStatusMutation.mutate({
                                                        stageId: stage.id,
                                                        payload: { status: 'COMPLETED' },
                                                      })
                                                    }
                                                    title={
                                                      priorIncomplete
                                                        ? 'Previous stage must be completed first'
                                                        : isLabOrderPending
                                                        ? `Prosthetic lab order (${stageLabOrder?.order_number}) is ${stageLabOrder?.status}. Must be READY before completing stage.`
                                                        : 'Mark stage complete'
                                                    }
                                                    data-testid={`stage-${stage.sequence}-complete-btn`}
                                                  >
                                                    <i className="ph ph-check-circle" /> Complete
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className={`${styles.btnStageAction} ${styles.btnStageHold}`}
                                                    onClick={() =>
                                                      updateStageStatusMutation.mutate({
                                                        stageId: stage.id,
                                                        payload: { status: 'ON_HOLD' },
                                                      })
                                                    }
                                                    title="Put stage on hold"
                                                  >
                                                    <i className="ph ph-pause" /> Hold
                                                  </button>
                                                </>
                                              )}

                                              {stage.status === 'ON_HOLD' && (
                                                <button
                                                  type="button"
                                                  className={`${styles.btnStageAction} ${styles.btnStageStart}`}
                                                  onClick={() =>
                                                    updateStageStatusMutation.mutate({
                                                      stageId: stage.id,
                                                      payload: { status: 'IN_PROGRESS' },
                                                    })
                                                  }
                                                >
                                                  <i className="ph ph-play" /> Resume
                                                </button>
                                              )}

                                              {priorIncomplete && (stage.status === 'PLANNED' || stage.status === 'IN_PROGRESS') && (
                                                <span className={styles.stagePrereqNotice}>
                                                  <i className="ph ph-lock-key" /> Prior stage pending
                                                </span>
                                              )}

                                              {isLabOrderPending && stage.status === 'IN_PROGRESS' && (
                                                <span className={styles.stageLabPrereqNotice} data-testid="stage-lab-pending-notice">
                                                  <i className="ph ph-hourglass-high" /> Lab: {stageLabOrder?.status} (awaiting Ready)
                                                </span>
                                              )}

                                              {/* Doctor reassign selector */}
                                              {doctors.length > 1 && (
                                                <select
                                                  className={styles.select}
                                                  style={{ padding: '2px 6px', fontSize: '0.725rem' }}
                                                  value={stage.assigned_doctor_id}
                                                  onChange={(e) =>
                                                    assignDoctorMutation.mutate({
                                                      stageId: stage.id,
                                                      payload: { doctor_id: e.target.value },
                                                    })
                                                  }
                                                  title="Reassign doctor for this stage"
                                                >
                                                  {doctors.map((doc) => (
                                                    <option key={doc.id} value={doc.id}>
                                                      Dr. {doc.display_name || `${doc.first_name} ${doc.last_name}`.trim()} ({doc.specialization || 'Dental'})
                                                    </option>
                                                  ))}
                                                </select>
                                              )}

                                              {/* Schedule appointment button for PLANNED stages */}
                                              {stage.status === 'PLANNED' && !priorIncomplete && (
                                                <button
                                                  type="button"
                                                  className={styles.btnStageAction}
                                                  style={{
                                                    background: isLabOrderPending ? '#f8fafc' : '#eff6ff',
                                                    color: isLabOrderPending ? '#94a3b8' : '#1d4ed8',
                                                    borderColor: isLabOrderPending ? '#e2e8f0' : '#bfdbfe',
                                                    cursor: isLabOrderPending ? 'not-allowed' : 'pointer',
                                                  }}
                                                  disabled={isLabOrderPending}
                                                  onClick={() => setScheduleModalStage(stage)}
                                                  title={
                                                    isLabOrderPending
                                                      ? `Prosthetic lab order (${stageLabOrder?.order_number}) is ${stageLabOrder?.status}. Must be READY before scheduling.`
                                                      : 'Schedule an appointment for this stage'
                                                  }
                                                  data-testid={`stage-${stage.sequence}-schedule-btn`}
                                                >
                                                  <i className="ph ph-calendar-plus" /> Schedule
                                                </button>
                                              )}

                                              {/* Reschedule / cancel appointment for SCHEDULED stages */}
                                              {stage.status === 'SCHEDULED' && stage.appointment_id && (
                                                <>
                                                  <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                    <i className="ph ph-calendar-check" /> Appt booked
                                                  </span>
                                                  <button
                                                    type="button"
                                                    className={styles.btnStageAction}
                                                    style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}
                                                    onClick={() => setViewAppointmentStageId(stage.id)}
                                                    title="View linked appointment details"
                                                  >
                                                    <i className="ph ph-eye" /> View Appt
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className={styles.btnStageAction}
                                                    style={{ background: '#fefce8', color: '#92400e', borderColor: '#fde68a' }}
                                                    onClick={() => setScheduleModalStage(stage)}
                                                    title="Reschedule appointment"
                                                  >
                                                    <i className="ph ph-calendar-x" /> Reschedule
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className={`${styles.btnStageAction} ${styles.btnStageDelete}`}
                                                    onClick={() => setCancelConfirmStageId(stage.id)}
                                                    title="Cancel appointment (stage returns to Planned)"
                                                  >
                                                    <i className="ph ph-x-circle" /> Cancel Appt
                                                  </button>
                                                </>
                                              )}

                                              {stage.status === 'PLANNED' && (
                                                <button
                                                  type="button"
                                                  className={`${styles.btnStageAction} ${styles.btnStageDelete}`}
                                                  onClick={() => deleteStageMutation.mutate(stage.id)}
                                                  title="Delete planned stage"
                                                >
                                                  <i className="ph ph-trash" />
                                                </button>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Inline Form to Add Stage */}
                                {isAddingStage && (
                                  <div className={styles.addStageInlineBox}>
                                    <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1e3a8a', marginBottom: '8px' }}>
                                      <i className="ph ph-plus-circle" /> Add New Treatment Stage (Step {itemStages.length + 1})
                                    </div>

                                    {/* Quick stage suggestions */}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                      {[
                                        'Root Canal Treatment',
                                        'Crown Measurement & Impression',
                                        'Crown Fitting & Cementation',
                                        'Core Build-up & Post',
                                        'Initial Cleaning & Prep',
                                        'Final Restoration & Polish',
                                      ].map((suggestion) => (
                                        <button
                                          key={suggestion}
                                          type="button"
                                          className={styles.chip}
                                          style={{ fontSize: '0.7rem', background: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd' }}
                                          onClick={() => setNewStageName(suggestion)}
                                        >
                                          {suggestion}
                                        </button>
                                      ))}
                                    </div>

                                    <div className={styles.addStageGrid}>
                                      <div>
                                        <label className={styles.label} style={{ fontSize: '0.75rem' }}>
                                          Stage Name <span style={{ color: '#dc2626' }}>*</span>
                                        </label>
                                        <input
                                          type="text"
                                          className={styles.input}
                                          style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                          placeholder="e.g. Crown Impression & Shade Selection"
                                          value={newStageName}
                                          onChange={(e) => setNewStageName(e.target.value)}
                                          required
                                        />
                                      </div>

                                      <div>
                                        <label className={styles.label} style={{ fontSize: '0.75rem' }}>
                                          Assigned Doctor <span style={{ color: '#dc2626' }}>*</span>
                                        </label>
                                        <select
                                          className={styles.select}
                                          style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                          value={newStageDoctorId}
                                          onChange={(e) => setNewStageDoctorId(e.target.value)}
                                          required
                                        >
                                          {doctors.length === 0 && <option value="">-- No doctors found --</option>}
                                          {doctors.map((doc) => (
                                            <option key={doc.id} value={doc.id}>
                                              Dr. {doc.display_name || `${doc.first_name} ${doc.last_name}`.trim()} ({doc.specialization || 'Dental'})
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label className={styles.label} style={{ fontSize: '0.75rem' }}>
                                          Planned Date (Optional)
                                        </label>
                                        <input
                                          type="date"
                                          className={styles.input}
                                          style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                          value={newStagePlannedDate}
                                          onChange={(e) => setNewStagePlannedDate(e.target.value)}
                                        />
                                      </div>

                                      <div>
                                        <label className={styles.label} style={{ fontSize: '0.75rem' }}>
                                          Notes (Optional)
                                        </label>
                                        <input
                                          type="text"
                                          className={styles.input}
                                          style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                          placeholder="e.g. Alginate impression, shade A2"
                                          value={newStageNotes}
                                          onChange={(e) => setNewStageNotes(e.target.value)}
                                        />
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                      <button
                                        type="button"
                                        className={styles.btnSecondary}
                                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                        onClick={handleCancelAddStage}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.btnPrimary}
                                        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                                        disabled={!newStageName.trim() || !newStageDoctorId || createStageMutation.isPending}
                                        onClick={() => handleSaveStage(item.id!, item.tooth_number, item.service_id)}
                                      >
                                        {createStageMutation.isPending ? 'Saving...' : 'Add Stage'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Add Treatment Item Form */}
          {!disabled && (
            <>
              {/* Service Catalogue Quick-Add */}
              {departmentServices.length > 0 && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px 14px',
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0369a1', marginBottom: '8px' }}>
                    <i className="ph ph-lightning" /> Quick-Add from Service Catalogue
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {departmentServices.map((svc) => (
                      <button
                        key={svc.id}
                        type="button"
                        className={styles.chip}
                        style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}
                        onClick={() => handleSelectService(svc)}
                        title={svc.standard_price > 0 ? `Standard price: ${formatCurrency(svc.standard_price)}` : undefined}
                      >
                        {svc.name}
                        {svc.standard_price > 0 && (
                          <span style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 600 }}>
                            {' '}· {formatCurrency(svc.standard_price)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form
                onSubmit={handleAddItem}
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '12px' }}>
                  Add Planned Dental Procedure
                </div>

                <div className={styles.treatmentFormGrid}>
                  {/* Tooth Selector */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tooth # (Optional)</label>
                    <select
                      className={styles.select}
                      value={toothNumber}
                      onChange={(e) => setToothNumber(e.target.value)}
                    >
                      <option value="">General / Full Mouth</option>
                      {examinedTeethNumbers.length > 0 && (
                        <optgroup label="Teeth with Examination Findings">
                          {examinedTeethNumbers.map((num) => (
                            <option key={num} value={num}>
                              Tooth #{num} - {TOOTH_NAMES[num] ?? getToothName(num)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Permanent Upper Right (Q1: 18 – 11)">
                        {PERMANENT_QUADRANTS.Q1_UPPER_RIGHT.map((num) => (
                          <option key={num} value={num}>
                            Tooth #{num} - {TOOTH_NAMES[num]}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Permanent Upper Left (Q2: 21 – 28)">
                        {PERMANENT_QUADRANTS.Q2_UPPER_LEFT.map((num) => (
                          <option key={num} value={num}>
                            Tooth #{num} - {TOOTH_NAMES[num]}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Permanent Lower Left (Q3: 31 – 38)">
                        {PERMANENT_QUADRANTS.Q3_LOWER_LEFT.map((num) => (
                          <option key={num} value={num}>
                            Tooth #{num} - {TOOTH_NAMES[num]}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Permanent Lower Right (Q4: 41 – 48)">
                        {PERMANENT_QUADRANTS.Q4_LOWER_RIGHT.map((num) => (
                          <option key={num} value={num}>
                            Tooth #{num} - {TOOTH_NAMES[num]}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Primary / Pediatric Teeth (51 – 85)">
                        {[
                          ...PRIMARY_QUADRANTS.Q5_UPPER_RIGHT,
                          ...PRIMARY_QUADRANTS.Q6_UPPER_LEFT,
                          ...PRIMARY_QUADRANTS.Q7_LOWER_LEFT,
                          ...PRIMARY_QUADRANTS.Q8_LOWER_RIGHT,
                        ].map((num) => (
                          <option key={num} value={num}>
                            Tooth #{num} - {TOOTH_NAMES[num] || `Primary Tooth ${num}`}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Service Catalogue Picker */}
                  {departmentServices.length > 0 && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Service Catalogue</label>
                      <select
                        className={styles.select}
                        value={selectedServiceId}
                        onChange={(e) => handleCatalogueDropdownChange(e.target.value)}
                      >
                        <option value="">-- Select from Catalogue --</option>
                        {departmentServices.map((svc) => (
                          <option key={svc.id} value={svc.id}>
                            {svc.name} {svc.standard_price > 0 ? `(${formatCurrency(svc.standard_price)})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Procedure Name Input */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Procedure Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      list="dental-procedure-suggestions"
                      placeholder="e.g. Composite Restoration, Root Canal Treatment, Scaling..."
                      className={styles.input}
                      value={procedureName}
                      onChange={(e) => {
                        setProcedureName(e.target.value);
                        const matchedSvc = departmentServices.find(
                          (s) => s.name.toLowerCase() === e.target.value.trim().toLowerCase(),
                        );
                        if (matchedSvc) {
                          setSelectedServiceId(matchedSvc.id);
                          if (matchedSvc.standard_price >= 0) {
                            setEstimatedCost(matchedSvc.standard_price.toString());
                          }
                        } else {
                          setSelectedServiceId('');
                        }
                      }}
                      required
                    />
                    <datalist id="dental-procedure-suggestions">
                      {departmentServices.map((svc) => (
                        <option key={svc.id} value={svc.name} />
                      ))}
                      {COMMON_DENTAL_PROCEDURES.map((p: string) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>

                  {/* Priority */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Priority</label>
                    <select
                      className={styles.select}
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as DentalTreatmentPriority)}
                    >
                      <option value="ROUTINE">Routine</option>
                      <option value="URGENT">Urgent</option>
                      <option value="ELECTIVE">Elective</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>

                  {/* Est. Cost */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Est. Cost</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className={styles.input}
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                    />
                  </div>

                  {/* Clinical Treatment Notes */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Treatment Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Shade A2, post & core, subgingival margins..."
                      className={styles.input}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                    {/* Submit Button */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: '18px' }}>
                    <button
                      type="submit"
                      className={styles.btnPrimary}
                      style={{ height: '36px', whiteSpace: 'nowrap', padding: '0 16px' }}
                    >
                      <i className="ph ph-plus" /> Add to Plan
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>

    {/* Treatment Quotations (Pricing) Card */}
    {episodeId && (
      <div className={styles.card} style={{ marginTop: '16px' }}>
        <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ph ph-receipt" style={{ color: '#0284c7', fontSize: '1.2rem' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>
              Treatment Quotations (Pricing)
            </h4>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: episodeQuotations.length > 0 ? '#e0f2fe' : '#f1f5f9',
                color: episodeQuotations.length > 0 ? '#0369a1' : '#64748b',
              }}
            >
              {episodeQuotations.length} {episodeQuotations.length === 1 ? 'quote' : 'quotes'}
            </span>
          </div>
          {!disabled && (
            <button
              type="button"
              className={styles.btnSecondary}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                fontSize: '0.8rem',
                borderColor: '#0284c7',
                color: '#0284c7',
                background: '#f0f9ff',
              }}
              disabled={items.length === 0}
              onClick={handleOpenQuotationModal}
              title={items.length === 0 ? 'Add treatment plan items before generating quotation' : 'Generate new draft quotation'}
            >
              <i className="ph ph-plus-circle" /> Generate Quotation
            </button>
          )}
        </div>

        <div className={styles.cardBody} style={{ padding: '12px 16px' }}>
          {quotationsLoading ? (
            <div style={{ padding: '16px 0', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
              Loading quotations…
            </div>
          ) : episodeQuotations.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
                fontSize: '0.85rem',
              }}
            >
              <i className="ph ph-file-text" style={{ fontSize: '1.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }} />
              No treatment quotations generated for this episode yet.
              {!disabled && items.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                    onClick={handleOpenQuotationModal}
                  >
                    <i className="ph ph-plus" /> Generate First Quotation
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table} style={{ width: '100%', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Quotation #</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Doctor</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Items</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>Subtotal</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>Discount</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>Total ({episodeQuotations[0]?.currency ?? 'KES'})</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Status</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {episodeQuotations.map((q) => {
                    const statusBadgeColors = (() => {
                      switch (q.status) {
                        case 'ACCEPTED':
                          return { bg: '#dcfce7', text: '#15803d', border: '#86efac' };
                        case 'REJECTED':
                          return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
                        case 'SENT':
                          return { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe' };
                        case 'POSTPONED':
                          return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
                        case 'EXPIRED':
                          return { bg: '#f3f4f6', text: '#9ca3af', border: '#e5e7eb' };
                        case 'DRAFT':
                        default:
                          return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
                      }
                    })();

                    return (
                      <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>
                          {q.quotation_number}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>
                          {new Date(q.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>
                          {q.doctor_name}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 600 }}>
                            {q.options && q.options.length > 0 ? `${q.options.length} options` : `${q.items.length} items`}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                          {formatCurrency(q.subtotal)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: q.discount_amount > 0 ? '#16a34a' : '#64748b' }}>
                          {q.discount_amount > 0 ? `-${formatCurrency(q.discount_amount)}` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {formatCurrency(q.total)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              background: statusBadgeColors.bg,
                              color: statusBadgeColors.text,
                              border: `1px solid ${statusBadgeColors.border}`,
                            }}
                          >
                            {q.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                              onClick={() => {
                                setSelectedQuotation(q);
                                setSelectedDecisionOptionId(
                                  q.selected_option_id ||
                                    (q.options && q.options.length > 0 ? (q.options[0]?.id || '') : ''),
                                );
                                setDecisionReasonInput('');
                                setDecisionMode('view');
                              }}
                            >
                              <i className="ph ph-eye" /> {q.status === 'SENT' ? 'Decide' : 'View'}
                            </button>
                            {q.status === 'DRAFT' && !disabled && (
                              <button
                                type="button"
                                className={styles.btnPrimary}
                                style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#4338ca', borderColor: '#4338ca' }}
                                disabled={sendQuotationMutation.isPending}
                                onClick={() => sendQuotationMutation.mutate(q.id)}
                                title="Send quotation to patient for decision"
                              >
                                <i className="ph ph-paper-plane-tilt" /> Send
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Generate Quotation Modal */}
    {showQuotationModal && (
      <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Generate Quotation">
        <div className={styles.modalCard} style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>
              <i className="ph ph-receipt" style={{ color: '#0284c7' }} /> Generate Treatment Quotation (Multiple Options)
            </h3>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setShowQuotationModal(false)}
              aria-label="Close"
            >
              <i className="ph ph-x" />
            </button>
          </div>
          <div style={{ fontSize: '0.85rem', margin: '12px 0 16px' }}>
            <p style={{ color: '#475569', marginBottom: '12px' }}>
              Create an immutable draft quotation for the patient with one or more treatment options (e.g. Option A: RCT + Crown vs Option B: Extraction) using Service Catalogue standard pricing.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Valid Until (Optional)</label>
                <input
                  type="date"
                  className={styles.input}
                  value={quoteValidUntil}
                  onChange={(e) => setQuoteValidUntil(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Quotation Notes (Optional)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  placeholder="e.g. Valid for 30 days, includes post-op check"
                />
              </div>
            </div>

            {/* Options Builder */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>
                <i className="ph ph-rows" style={{ color: '#0284c7' }} /> Treatment Options ({quoteOptions.length})
              </h4>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                onClick={handleAddOption}
              >
                <i className="ph ph-plus" /> Add Option
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {quoteOptions.map((opt) => {
                const optSubtotal = opt.items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);
                const optDisc = parseFloat(opt.discount_amount) || 0;
                const optTax = parseFloat(opt.tax_amount) || 0;
                const optTotal = Math.max(0, optSubtotal - optDisc + optTax);

                return (
                  <div
                    key={opt.id}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: '10px' }}>
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '10px' }}>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Option Name</label>
                          <input
                            type="text"
                            className={styles.input}
                            value={opt.name}
                            onChange={(e) => handleOptionChange(opt.id, 'name', e.target.value)}
                            placeholder="e.g. Option A – Recommended RCT"
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Description (Optional)</label>
                          <input
                            type="text"
                            className={styles.input}
                            value={opt.description}
                            onChange={(e) => handleOptionChange(opt.id, 'description', e.target.value)}
                            placeholder="e.g. Complete root canal and ceramic crown restoration"
                          />
                        </div>
                      </div>
                      {quoteOptions.length > 1 && (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '4px 8px', marginTop: '20px' }}
                          onClick={() => handleRemoveOption(opt.id)}
                          title="Remove Option"
                        >
                          <i className="ph ph-trash" /> Remove
                        </button>
                      )}
                    </div>

                    {/* Items table for this option */}
                    <table className={styles.table} style={{ width: '100%', fontSize: '0.8rem', marginBottom: '8px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ textAlign: 'left', padding: '4px 6px' }}>Procedure</th>
                          <th style={{ textAlign: 'center', padding: '4px 6px', width: '90px' }}>Tooth #</th>
                          <th style={{ textAlign: 'center', padding: '4px 6px', width: '60px' }}>Qty</th>
                          <th style={{ textAlign: 'right', padding: '4px 6px', width: '110px' }}>Unit Price</th>
                          <th style={{ textAlign: 'right', padding: '4px 6px', width: '100px' }}>Total</th>
                          <th style={{ textAlign: 'center', padding: '4px 6px', width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {opt.items.map((item) => {
                          const lineTotal = item.quantity * item.unit_price;
                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  type="text"
                                  className={styles.input}
                                  style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                  value={item.procedure_name}
                                  onChange={(e) => handleOptionItemChange(opt.id, item.id, 'procedure_name', e.target.value)}
                                  placeholder="Procedure name"
                                />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  className={styles.input}
                                  style={{ padding: '4px 6px', fontSize: '0.8rem', textAlign: 'center' }}
                                  value={item.tooth_number ?? ''}
                                  onChange={(e) =>
                                    handleOptionItemChange(
                                      opt.id,
                                      item.id,
                                      'tooth_number',
                                      e.target.value ? parseInt(e.target.value, 10) : null,
                                    )
                                  }
                                  placeholder="Tooth #"
                                />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="1"
                                  className={styles.input}
                                  style={{ padding: '4px 6px', fontSize: '0.8rem', textAlign: 'center' }}
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleOptionItemChange(
                                      opt.id,
                                      item.id,
                                      'quantity',
                                      Math.max(1, parseInt(e.target.value, 10) || 1),
                                    )
                                  }
                                />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className={styles.input}
                                  style={{ padding: '4px 6px', fontSize: '0.8rem', textAlign: 'right' }}
                                  value={item.unit_price}
                                  onChange={(e) =>
                                    handleOptionItemChange(
                                      opt.id,
                                      item.id,
                                      'unit_price',
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>
                                {formatCurrency(lineTotal)}
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                {opt.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOptionItem(opt.id, item.id)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                    title="Delete item"
                                  >
                                    <i className="ph ph-x" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                        onClick={() => handleAddOptionItem(opt.id)}
                      >
                        <i className="ph ph-plus" /> Add Item
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Discount:</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={styles.input}
                            style={{ width: '80px', padding: '2px 6px', fontSize: '0.8rem' }}
                            value={opt.discount_amount}
                            onChange={(e) => handleOptionChange(opt.id, 'discount_amount', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Tax:</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={styles.input}
                            style={{ width: '80px', padding: '2px 6px', fontSize: '0.8rem' }}
                            value={opt.tax_amount}
                            onChange={(e) => handleOptionChange(opt.id, 'tax_amount', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                          Total: <span style={{ color: '#0284c7' }}>{formatCurrency(optTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comparison Overview Bar */}
            <div
              style={{
                background: '#f0f9ff',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #bae6fd',
                marginTop: '16px',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0369a1', marginBottom: '6px' }}>
                OPTIONS SUMMARY COMPARISON
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {quoteOptions.map((opt, idx) => {
                  const optSub = opt.items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);
                  const optDisc = parseFloat(opt.discount_amount) || 0;
                  const optTax = parseFloat(opt.tax_amount) || 0;
                  const optTot = Math.max(0, optSub - optDisc + optTax);
                  return (
                    <div
                      key={opt.id}
                      style={{
                        background: '#ffffff',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #e0f2fe',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#334155' }}>{opt.name || `Option ${idx + 1}`}: </span>
                      <strong style={{ color: '#0284c7' }}>{formatCurrency(optTot)}</strong>
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}> ({opt.items.length} items)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setShowQuotationModal(false)}
              disabled={createQuotationMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={createQuotationMutation.isPending || quoteOptions.length === 0}
              onClick={() => {
                if (!episodeId) return;
                const formattedOptions = quoteOptions.map((opt) => ({
                  name: opt.name.trim() || 'Option',
                  description: opt.description.trim() || undefined,
                  discount_amount: parseFloat(opt.discount_amount) || 0,
                  tax_amount: parseFloat(opt.tax_amount) || 0,
                  items: opt.items.map((it) => ({
                    treatment_plan_item_id: it.treatment_plan_item_id,
                    service_id: it.service_id,
                    procedure_name: it.procedure_name.trim() || 'Dental Procedure',
                    tooth_number: it.tooth_number ?? undefined,
                    quantity: it.quantity || 1,
                    unit_price: it.unit_price || 0,
                  })),
                }));

                createQuotationMutation.mutate(
                  {
                    episodeId,
                    payload: {
                      notes: quoteNotes.trim() || undefined,
                      valid_until: quoteValidUntil || undefined,
                      options: formattedOptions,
                    },
                  },
                  {
                    onSuccess: () => {
                      setShowQuotationModal(false);
                      setQuoteNotes('');
                      setQuoteValidUntil('');
                    },
                  },
                );
              }}
            >
              <i className="ph ph-check" />
              {createQuotationMutation.isPending ? 'Generating…' : 'Create Draft Quotation'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* View Quotation Details / Decision Modal */}
    {selectedQuotation && (
      <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Quotation Details">
        <div className={styles.modalCard} style={{ maxWidth: 780, maxHeight: '90vh', overflowY: 'auto' }}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>
              <i className="ph ph-file-text" style={{ color: '#0284c7' }} /> Quotation #{selectedQuotation.quotation_number}
            </h3>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setSelectedQuotation(null)}
              aria-label="Close"
            >
              <i className="ph ph-x" />
            </button>
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: '1.6', margin: '12px 0 16px' }}>
            
            {/* Status Banners */}
            {selectedQuotation.status === 'ACCEPTED' && (
              <div
                style={{
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  color: '#14532d',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                  <i className="ph ph-check-circle" style={{ fontSize: '1.2rem', color: '#16a34a' }} />
                  Patient Decision: Option Accepted
                </div>
                {selectedQuotation.selected_option_name && (
                  <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                    Accepted Option: <strong>{selectedQuotation.selected_option_name}</strong>
                  </div>
                )}
                {selectedQuotation.accepted_at && (
                  <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '2px' }}>
                    Accepted on {new Date(selectedQuotation.accepted_at).toLocaleString()}
                    {selectedQuotation.accepted_by ? ` (recorded by: ${selectedQuotation.accepted_by})` : ''}
                  </div>
                )}
                <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '6px', fontWeight: 600 }}>
                  <i className="ph ph-arrow-clockwise" /> Procedures synchronized with active Treatment Plan.
                </div>
              </div>
            )}

            {selectedQuotation.status === 'REJECTED' && (
              <div
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  color: '#991b1b',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                  <i className="ph ph-x-circle" style={{ fontSize: '1.2rem', color: '#dc2626' }} />
                  Patient Decision: Quotation Rejected
                </div>
                {selectedQuotation.decision_reason && (
                  <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                    Reason: <em>{selectedQuotation.decision_reason}</em>
                  </div>
                )}
                {selectedQuotation.decision_at && (
                  <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '2px' }}>
                    Recorded on {new Date(selectedQuotation.decision_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {selectedQuotation.status === 'POSTPONED' && (
              <div
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  color: '#334155',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                  <i className="ph ph-clock" style={{ fontSize: '1.2rem', color: '#64748b' }} />
                  Patient Decision: Postponed
                </div>
                {selectedQuotation.decision_reason && (
                  <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                    Remark: <em>{selectedQuotation.decision_reason}</em>
                  </div>
                )}
                {selectedQuotation.decision_at && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    Postponed on {new Date(selectedQuotation.decision_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 12px', marginBottom: '14px' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Status:</span>
              <span style={{ fontWeight: 700, color: selectedQuotation.status === 'ACCEPTED' ? '#15803d' : selectedQuotation.status === 'REJECTED' ? '#b91c1c' : '#b45309' }}>
                {selectedQuotation.status}
              </span>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Doctor:</span>
              <span>{selectedQuotation.doctor_name}</span>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Date Created:</span>
              <span>{new Date(selectedQuotation.created_at).toLocaleString()}</span>
              {selectedQuotation.sent_at && (
                <>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Date Sent:</span>
                  <span>{new Date(selectedQuotation.sent_at).toLocaleString()}</span>
                </>
              )}
              {selectedQuotation.valid_until && (
                <>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Valid Until:</span>
                  <span>{new Date(selectedQuotation.valid_until).toLocaleDateString()}</span>
                </>
              )}
              {selectedQuotation.notes && (
                <>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Notes:</span>
                  <span>{selectedQuotation.notes}</span>
                </>
              )}
            </div>

            {/* If quotation has multiple options, display multi-option breakdown */}
            {selectedQuotation.options && selectedQuotation.options.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                    Presented Treatment Options ({selectedQuotation.options.length})
                  </div>
                  {(selectedQuotation.status === 'SENT' || selectedQuotation.status === 'POSTPONED') && (
                    <span style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 600 }}>
                      <i className="ph ph-hand-pointing" /> Select an option below to accept
                    </span>
                  )}
                </div>

                {selectedQuotation.options.map((opt, optIdx) => {
                  const isSelected =
                    selectedQuotation.status === 'ACCEPTED'
                      ? selectedQuotation.selected_option_id === opt.id
                      : selectedDecisionOptionId === opt.id;

                  const canSelect = selectedQuotation.status === 'SENT' || selectedQuotation.status === 'POSTPONED';

                  return (
                    <div
                      key={opt.id ?? optIdx}
                      onClick={() => {
                        if (canSelect && opt.id) {
                          setSelectedDecisionOptionId(opt.id);
                        }
                      }}
                      style={{
                        border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px',
                        background: isSelected ? '#f0f9ff' : '#f8fafc',
                        cursor: canSelect ? 'pointer' : 'default',
                        transition: 'all 0.15s ease-in-out',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {canSelect && (
                            <input
                              type="radio"
                              name="decisionOptionRadio"
                              checked={selectedDecisionOptionId === opt.id}
                              onChange={() => opt.id && setSelectedDecisionOptionId(opt.id)}
                              style={{ cursor: 'pointer' }}
                            />
                          )}
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                            {opt.name}
                          </span>
                          {selectedQuotation.status === 'ACCEPTED' && selectedQuotation.selected_option_id === opt.id && (
                            <span
                              style={{
                                background: '#dcfce7',
                                color: '#15803d',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                              }}
                            >
                              ✓ ACCEPTED OPTION
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            background: isSelected ? '#bae6fd' : '#e0f2fe',
                            color: '#0369a1',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          Total: {formatCurrency(opt.total ?? 0)}
                        </span>
                      </div>
                      {opt.description && (
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#64748b' }}>
                          {opt.description}
                        </p>
                      )}

                      <table className={styles.table} style={{ width: '100%', fontSize: '0.8rem', marginBottom: '8px', background: '#ffffff' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            <th style={{ textAlign: 'left', padding: '4px 6px' }}>#</th>
                            <th style={{ textAlign: 'left', padding: '4px 6px' }}>Procedure</th>
                            <th style={{ textAlign: 'center', padding: '4px 6px' }}>Tooth</th>
                            <th style={{ textAlign: 'center', padding: '4px 6px' }}>Qty</th>
                            <th style={{ textAlign: 'right', padding: '4px 6px' }}>Unit Price</th>
                            <th style={{ textAlign: 'right', padding: '4px 6px' }}>Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(opt.items ?? []).map((it, idx) => (
                            <tr key={it.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '4px 6px', color: '#64748b' }}>{idx + 1}</td>
                              <td style={{ padding: '4px 6px', fontWeight: 600 }}>{it.procedure_name}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'center', color: '#64748b' }}>
                                {it.tooth_number ? `Tooth #${it.tooth_number}` : 'General'}
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>{it.quantity}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(it.unit_price ?? 0)}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>
                                {formatCurrency(it.line_total ?? (it.unit_price ?? 0) * (it.quantity ?? 1))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', fontSize: '0.8rem', color: '#64748b' }}>
                        <span>Subtotal: {formatCurrency(opt.subtotal ?? 0)}</span>
                        {(opt.discount_amount ?? 0) > 0 && <span style={{ color: '#16a34a' }}>Discount: -{formatCurrency(opt.discount_amount ?? 0)}</span>}
                        {(opt.tax_amount ?? 0) > 0 && <span>Tax: +{formatCurrency(opt.tax_amount ?? 0)}</span>}
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>Option Total: {formatCurrency(opt.total ?? 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Legacy single-item list
              <>
                <table className={styles.table} style={{ width: '100%', fontSize: '0.8rem', marginBottom: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Procedure</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px' }}>Tooth</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Unit Price</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuotation.items.map((it, idx) => (
                      <tr key={it.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{it.procedure_name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>
                          {it.tooth_number ? `Tooth #${it.tooth_number}` : 'General'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{it.quantity}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(it.unit_price)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(it.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div
                  style={{
                    background: '#f8fafc',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedQuotation.subtotal)}</span>
                  </div>
                  {selectedQuotation.discount_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedQuotation.discount_amount)}</span>
                    </div>
                  )}
                  {selectedQuotation.tax_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Tax</span>
                      <span>+{formatCurrency(selectedQuotation.tax_amount)}</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: '#0f172a',
                      borderTop: '1px solid #cbd5e1',
                      paddingTop: '6px',
                      marginTop: '4px',
                    }}
                  >
                    <span>Grand Total ({selectedQuotation.currency})</span>
                    <span>{formatCurrency(selectedQuotation.total)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Reject / Postpone Reason Inputs */}
            {decisionMode === 'reject' && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}>
                <label className={styles.label} style={{ color: '#991b1b', fontWeight: 600 }}>
                  Reason for Rejection (Optional)
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Patient prefers conservative observation or seeks second opinion"
                  value={decisionReasonInput}
                  onChange={(e) => setDecisionReasonInput(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>
            )}

            {decisionMode === 'postpone' && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                <label className={styles.label} style={{ color: '#334155', fontWeight: 600 }}>
                  Postponement Remark (Optional)
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Decision postponed pending family discussion or insurance verification"
                  value={decisionReasonInput}
                  onChange={(e) => setDecisionReasonInput(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
            <div>
              {selectedQuotation.status === 'DRAFT' && !disabled && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  style={{ background: '#4338ca', borderColor: '#4338ca' }}
                  disabled={sendQuotationMutation.isPending}
                  onClick={() => {
                    sendQuotationMutation.mutate(selectedQuotation.id, {
                      onSuccess: (updated) => setSelectedQuotation(updated),
                    });
                  }}
                >
                  <i className="ph ph-paper-plane-tilt" />
                  {sendQuotationMutation.isPending ? 'Sending…' : 'Send to Patient'}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {/* Decision Action Buttons for SENT / POSTPONED quotations */}
              {(selectedQuotation.status === 'SENT' || selectedQuotation.status === 'POSTPONED') && !disabled && (
                <>
                  {decisionMode === 'view' ? (
                    <>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ color: '#475569', borderColor: '#cbd5e1' }}
                        onClick={() => {
                          setDecisionMode('postpone');
                          setDecisionReasonInput('');
                        }}
                      >
                        <i className="ph ph-clock" /> Postpone
                      </button>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                        onClick={() => {
                          setDecisionMode('reject');
                          setDecisionReasonInput('');
                        }}
                      >
                        <i className="ph ph-x-circle" /> Reject
                      </button>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        style={{ background: '#16a34a', borderColor: '#16a34a' }}
                        disabled={acceptQuotationMutation.isPending || (!selectedDecisionOptionId && selectedQuotation.options && selectedQuotation.options.length > 0)}
                        onClick={() => {
                          acceptQuotationMutation.mutate(
                            {
                              quotationId: selectedQuotation.id,
                              payload: {
                                selected_option_id: selectedDecisionOptionId,
                              },
                            },
                            {
                              onSuccess: (updated) => {
                                setSelectedQuotation(updated);
                              },
                            },
                          );
                        }}
                      >
                        <i className="ph ph-check-circle" />
                        {acceptQuotationMutation.isPending ? 'Accepting…' : 'Accept Option'}
                      </button>
                    </>
                  ) : decisionMode === 'reject' ? (
                    <>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => setDecisionMode('view')}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        style={{ background: '#dc2626', borderColor: '#dc2626' }}
                        disabled={rejectQuotationMutation.isPending}
                        onClick={() => {
                          rejectQuotationMutation.mutate(
                            {
                              quotationId: selectedQuotation.id,
                              payload: {
                                reason: decisionReasonInput.trim() || undefined,
                              },
                            },
                            {
                              onSuccess: (updated) => {
                                setSelectedQuotation(updated);
                                setDecisionMode('view');
                              },
                            },
                          );
                        }}
                      >
                        <i className="ph ph-x-circle" />
                        {rejectQuotationMutation.isPending ? 'Rejecting…' : 'Confirm Rejection'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => setDecisionMode('view')}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        style={{ background: '#475569', borderColor: '#475569' }}
                        disabled={postponeQuotationMutation.isPending}
                        onClick={() => {
                          postponeQuotationMutation.mutate(
                            {
                              quotationId: selectedQuotation.id,
                              payload: {
                                reason: decisionReasonInput.trim() || undefined,
                              },
                            },
                            {
                              onSuccess: (updated) => {
                                setSelectedQuotation(updated);
                                setDecisionMode('view');
                              },
                            },
                          );
                        }}
                      >
                        <i className="ph ph-clock" />
                        {postponeQuotationMutation.isPending ? 'Saving…' : 'Confirm Postponement'}
                      </button>
                    </>
                  )}
                </>
              )}

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setSelectedQuotation(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )}


    {/* Schedule / Reschedule Modal */}
    {scheduleModalStage && (
      <DentalStageScheduleModal
        stage={scheduleModalStage}
        doctors={doctors}
        onClose={() => setScheduleModalStage(null)}
      />
    )}

    {/* View Appointment Details Modal */}
    {viewAppointmentStageId && (
      <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Appointment Details">
        <div className={styles.modalCard} style={{ maxWidth: 460 }}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>
              <i className="ph ph-calendar-check" style={{ color: '#166534' }} /> Appointment Details
            </h3>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setViewAppointmentStageId(null)}
              aria-label="Close"
            >
              <i className="ph ph-x" />
            </button>
          </div>
          {stageAppointmentLoading ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
              Loading appointment details…
            </div>
          ) : stageAppointmentData ? (
            <div style={{ fontSize: '0.85rem', lineHeight: '1.6', margin: '12px 0 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 12px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Appt Number:</span>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>{stageAppointmentData.appointment_number}</span>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Date & Time:</span>
                <span>{stageAppointmentData.appointment_date} at {stageAppointmentData.start_time} – {stageAppointmentData.end_time}</span>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Duration:</span>
                <span>{stageAppointmentData.duration_minutes} minutes</span>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Doctor:</span>
                <span>Dr. {stageAppointmentData.doctor_name}</span>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Status:</span>
                <span style={{ fontWeight: 600, color: '#166534' }}>{stageAppointmentData.status}</span>
                {stageAppointmentData.reason && (
                  <>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Reason:</span>
                    <span>{stageAppointmentData.reason}</span>
                  </>
                )}
                {stageAppointmentData.notes && (
                  <>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Notes:</span>
                    <span>{stageAppointmentData.notes}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px 0', fontSize: '0.85rem', color: '#64748b' }}>
              Appointment details not found.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setViewAppointmentStageId(null)}
            >
              Close
            </button>
            {stageAppointmentData && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => {
                  const targetStage = allStages.find((s) => s.id === viewAppointmentStageId);
                  setViewAppointmentStageId(null);
                  if (targetStage) setScheduleModalStage(targetStage);
                }}
              >
                <i className="ph ph-calendar-x" /> Reschedule
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Prosthetic Lab Order Create Modal */}
    {labOrderCreateStage && (
      <DentalProstheticLabModal
        isOpen={Boolean(labOrderCreateStage)}
        onClose={() => setLabOrderCreateStage(null)}
        stage={labOrderCreateStage}
        patientId={patientId}
        readOnly={disabled}
      />
    )}

    {/* Prosthetic Lab Order View Modal */}
    {viewLabOrderId && (
      <DentalProstheticLabModal
        isOpen={Boolean(viewLabOrderId)}
        onClose={() => setViewLabOrderId(null)}
        existingOrderId={viewLabOrderId}
        readOnly={disabled}
      />
    )}

    {/* Cancel Appointment Confirmation */}
    {cancelConfirmStageId && (
      <div className={styles.modalOverlay} role="dialog" aria-modal="true">
        <div className={styles.modalCard} style={{ maxWidth: 420 }}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>
              <i className="ph ph-warning-circle" style={{ color: '#dc2626' }} /> Cancel Appointment
            </h3>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setCancelConfirmStageId(null)}
              aria-label="Close"
            >
              <i className="ph ph-x" />
            </button>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#374151', margin: '12px 0 20px' }}>
            This will cancel the booked appointment and revert this stage back to <strong>Planned</strong> so it can be rescheduled.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setCancelConfirmStageId(null)}
              disabled={cancelAppointmentMutation.isPending}
            >
              Keep Appointment
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              style={{ background: '#dc2626', borderColor: '#dc2626' }}
              disabled={cancelAppointmentMutation.isPending}
              onClick={() => {
                cancelAppointmentMutation.mutate(
                  { stageId: cancelConfirmStageId },
                  { onSuccess: () => setCancelConfirmStageId(null) },
                );
              }}
            >
              <i className="ph ph-x-circle" />
              {cancelAppointmentMutation.isPending ? 'Cancelling…' : 'Yes, Cancel Appointment'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
