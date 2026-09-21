import React, { useMemo, useState } from 'react';
import type {
  DentalStageStatus,
  DentalTreatmentPlanItem,
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
  usePatientDentalEpisodes,
} from '../../../hooks/opd/useOpd';
import { useDoctorsList } from '../../../hooks/doctors/useDoctors';
import type { DoctorResponse } from '../../../api/doctors';
import {
  COMMON_DENTAL_PROCEDURES,
  TOOTH_NAMES,
  getToothName,
} from '../../../pages/dental-utils';
import { DentalStageScheduleModal } from './DentalStageScheduleModal';
import { DentalProstheticLabModal } from './DentalProstheticLabModal';
import { useEpisodeDentalLabOrders } from '../../../hooks/opd/useOpd';
import styles from './DentalExamination.module.css';

function formatDoctorName(name: string | undefined | null): string {
  if (!name) return '';
  const clean = name.replace(/^Dr\.?\s+/i, '').trim();
  return clean ? `Dr. ${clean}` : '';
}

const DEFAULT_DENTAL_PROCEDURE_PRICES: Record<string, number> = {
  'Root Canal Treatment': 12000,
  'Root Canal Treatment (RCT)': 12000,
  'Direct Composite Filling': 3500,
  'Composite Restoration': 3500,
  'Glass Ionomer Filling': 2000,
  'Glass Ionomer Cement (GIC) Restoration': 2000,
  'Crown': 18000,
  'Zirconia Crown': 25000,
  'Porcelain-Fused-to-Metal Crown': 15000,
  'Dental Cleaning / Scaling': 3000,
  'Scaling and Polishing': 3000,
  'Scaling & Polishing (Prophylaxis)': 3000,
  'Simple Tooth Extraction': 2500,
  'Simple Dental Extraction': 2500,
  'Surgical Extraction / Disimpaction': 8000,
  'Dental Implant Placement': 65000,
  'Post & Core Build-up': 5000,
  'Complete Denture (Maxillary / Mandibular)': 25000,
  'Removable Partial Denture': 12000,
};

export function isStageClinicallyCompatible(procedureName: string, stageName: string): boolean {
  const p = (procedureName || '').toLowerCase();
  const s = (stageName || '').toLowerCase();

  const isExtractionProc = /extraction|exodontia|disimpaction|socket\b/i.test(p);
  const isEndoProc = /root canal|rct|pulpectomy|pulpotomy|endodont/i.test(p);
  const isProstheticProc = /crown|bridge|veneer|inlay|onlay|denture|prosthes/i.test(p);
  const isRestorativeProc = /restoration|filling|composite|gic|amalgam|glass ionomer|cavity/i.test(p);
  const isScalingProc = /scaling|prophylaxis|root planing|curettage|periodont/i.test(p);

  const isExtractionStage = /extraction|exodontia|disimpaction|socket debridement/i.test(s);
  const isEndoStage = /root canal|rct|pulpectomy|pulpotomy|canal instrumentation|canal shaping|canal obturation|working length/i.test(s);
  const isProstheticStage = /crown measurement|crown impression|crown fitting|crown cementation|prosthetic lab|framework try-in|veneer impression/i.test(s);
  const isRestorativeStage = /cavity preparation|caries excavation|composite.*restoration|gic.*restoration/i.test(s);
  const isScalingStage = /ultrasonic scaling|subgingival curettage|root planing/i.test(s);

  if (isExtractionProc && (isEndoStage || isProstheticStage || isRestorativeStage || isScalingStage)) {
    return false;
  }
  if (isEndoProc && (isExtractionStage || isProstheticStage || isScalingStage)) {
    return false;
  }
  if (isProstheticProc && (isExtractionStage || isEndoStage || isScalingStage)) {
    return false;
  }
  if (isRestorativeProc && (isExtractionStage || isEndoStage || isProstheticStage)) {
    return false;
  }
  if (isScalingProc && (isExtractionStage || isEndoStage || isProstheticStage || isRestorativeStage)) {
    return false;
  }

  return true;
}

function getProcedureStageSuggestions(procedureName: string): string[] {
  const p = (procedureName || '').toLowerCase();
  if (/extraction|exodontia|disimpaction|socket\b/i.test(p)) {
    return [
      'Pre-Extraction Assessment & Local Anesthesia',
      'Tooth Extraction & Socket Debridement',
      'Hemostasis & Suture Placement',
      'Post-Op Suture Removal & Review',
    ];
  }
  if (/root canal|rct|pulpectomy|pulpotomy|endodont/i.test(p)) {
    return [
      'Access Opening & Pulp Extirpation',
      'Canal Instrumentation & Shaping',
      'Canal Obturation & Sealing',
      'Core Build-up & Post',
      'Post-RCT Clinical Review',
    ];
  }
  if (/crown|bridge|prosthes|onlay|inlay|veneer/i.test(p)) {
    return [
      'Tooth Preparation & Gingival Retraction',
      'Crown Measurement & Impression',
      'Prosthetic Lab Fabrication',
      'Crown Fitting & Cementation',
    ];
  }
  if (/implant/i.test(p)) {
    return [
      'Implant Site Preparation & Placement',
      'Osseointegration Review & Healing Cap',
      'Abutment Placement & Impression',
      'Implant Crown Delivery & Occlusion',
    ];
  }
  if (/scaling|periodont|polishing|prophylaxis|curettage/i.test(p)) {
    return [
      'Full Mouth Ultrasonic Scaling',
      'Subgingival Curettage & Root Planing',
      'Periodontal Review & Polishing',
    ];
  }
  if (/restoration|filling|composite|gic|amalgam/i.test(p)) {
    return [
      'Cavity Preparation & Excavation',
      'Composite / GIC Restoration & Curing',
      'Occlusion Finishing & Polishing',
    ];
  }
  return [
    'Clinical Preparation & Anesthesia',
    'Primary Clinical Procedure Execution',
    'Post-Op Review & Final Restoration',
  ];
}

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
  /** Callback to trigger starting a treatment episode from diagnosis & plan context */
  onStartEpisode?: () => void;
  /** Patient display name for quotation modal header context */
  patientName?: string | null;
  /** Treatment Episode Number for quotation modal header context */
  episodeNumber?: string | number | null;
  /** Primary tooth number for quotation modal header context */
  primaryToothNumber?: number | null;
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
  onStartEpisode,
  patientName = null,
  episodeNumber = null,
  primaryToothNumber = null,
}) => {
  const formatCurrency = useCurrencyFormatter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [toothNumber, setToothNumber] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [procedureName, setProcedureName] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [dependsOnPlanItemId, setDependsOnPlanItemId] = useState<string>('');
  const [showAddTreatmentForm, setShowAddTreatmentForm] = useState<boolean>(false);

  const catalogueServicesList = useMemo(() => {
    const list: Array<{ id: string; name: string; standard_price: number }> = [];
    const seenNames = new Set<string>();

    for (const svc of departmentServices) {
      if (svc.name && !seenNames.has(svc.name.toLowerCase())) {
        seenNames.add(svc.name.toLowerCase());
        list.push({
          id: svc.id,
          name: svc.name,
          standard_price: svc.standard_price ?? 0,
        });
      }
    }

    for (const proc of COMMON_DENTAL_PROCEDURES) {
      if (!seenNames.has(proc.toLowerCase())) {
        seenNames.add(proc.toLowerCase());
        const matchedPrice =
          DEFAULT_DENTAL_PROCEDURE_PRICES[proc] ??
          Object.entries(DEFAULT_DENTAL_PROCEDURE_PRICES).find(([k]) =>
            proc.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(proc.toLowerCase())
          )?.[1] ??
          0;
        list.push({
          id: `dent-proc-${proc.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name: proc,
          standard_price: matchedPrice,
        });
      }
    }

    return list;
  }, [departmentServices]);

  // Treatment Stages state
  const [expandedStageRows, setExpandedStageRows] = useState<Set<string>>(new Set());
  const [addingStageForItem, setAddingStageForItem] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDoctorId, setNewStageDoctorId] = useState('');
  const [newStageNotes, setNewStageNotes] = useState('');
  const [newStagePlannedDate, setNewStagePlannedDate] = useState('');

  // Patient episodes fallback if episodeId is not explicitly passed
  const { data: patientEpisodes = [] } = usePatientDentalEpisodes(patientId ?? undefined);
  const effectiveEpisodeId = useMemo(() => {
    if (episodeId) return episodeId;
    const active = patientEpisodes.find((e) => e.status === 'ACTIVE');
    if (active) return active.id;
    return patientEpisodes[0]?.id ?? null;
  }, [episodeId, patientEpisodes]);

  // Lab Order modal state
  const [labOrderCreateStage, setLabOrderCreateStage] = useState<DentalTreatmentStageResponse | null>(null);
  const [viewLabOrderId, setViewLabOrderId] = useState<string | null>(null);
  const { data: episodeLabOrders = [] } = useEpisodeDentalLabOrders(effectiveEpisodeId);

  // Scheduling modal state
  const [scheduleModalStage, setScheduleModalStage] = useState<DentalTreatmentStageResponse | null>(null);
  const [cancelConfirmStageId, setCancelConfirmStageId] = useState<string | null>(null);
  const [viewAppointmentStageId, setViewAppointmentStageId] = useState<string | null>(null);

  // Queries & Mutations
  const { data: allStages = [] } = useDentalStages(effectiveEpisodeId);
  const { data: stageAppointmentData, isLoading: stageAppointmentLoading } = useDentalStageAppointment(viewAppointmentStageId);
  const { data: doctorsData } = useDoctorsList(departmentId ? { department_id: departmentId } : {});
  const doctors: DoctorResponse[] = useMemo(() => doctorsData?.data ?? [], [doctorsData]);

  const createStageMutation = useCreateDentalStage();
  const assignDoctorMutation = useAssignDoctorToDentalStage();
  const updateStageStatusMutation = useUpdateDentalStageStatus();
  const deleteStageMutation = useDeleteDentalStage(effectiveEpisodeId ?? undefined);
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

  const examinedTeeth = useMemo(() => {
    return [...teeth].sort((a, b) => a.tooth_number - b.tooth_number);
  }, [teeth]);

  const examinedTeethNumbers = useMemo(() => {
    return examinedTeeth.map((t) => t.tooth_number);
  }, [examinedTeeth]);

  const quotationTeeth = useMemo(() => {
    const itemTeeth = Array.from(
      new Set(
        items
          .map((it) => it.tooth_number)
          .filter((tn): tn is number => typeof tn === 'number' && tn > 0),
      ),
    );
    if (itemTeeth.length > 0) return itemTeeth;
    if (primaryToothNumber) return [primaryToothNumber];
    return [];
  }, [items, primaryToothNumber]);

  const candidatePrerequisites = useMemo(() => {
    const parsedTooth = toothNumber ? Number(toothNumber) : null;
    return items.filter((it) => {
      if (parsedTooth !== null && it.tooth_number !== null && it.tooth_number !== parsedTooth) {
        return false;
      }
      return true;
    });
  }, [items, toothNumber]);

  const proposedItems = useMemo(
    () => items.filter((it) => !it.status || it.status === 'PROPOSED'),
    [items],
  );

  const handleOpenQuotationModal = () => {
    const itemsToQuote = proposedItems.length > 0 ? proposedItems : items;
    const defaultOptionItems: OptionDraftItem[] = itemsToQuote.map((it, idx) => {
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

  const handleAddProposedItemToOption = (optId: string, item: DentalTreatmentPlanItem) => {
    const matchedSvc = departmentServices.find(
      (s) => s.id === item.service_id || s.name.toLowerCase() === item.procedure_name.toLowerCase(),
    );
    const price = matchedSvc ? matchedSvc.standard_price : (item.estimated_cost ?? 0);
    setQuoteOptions((prev) =>
      prev.map((opt) => {
        if (opt.id !== optId) return opt;
        return {
          ...opt,
          items: [
            ...opt.items.filter((it) => it.procedure_name.trim() !== ''),
            {
              id: `opt-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              treatment_plan_item_id: item.id ?? undefined,
              service_id: item.service_id || matchedSvc?.id || undefined,
              procedure_name: item.procedure_name,
              tooth_number: item.tooth_number ?? null,
              quantity: 1,
              unit_price: price,
            },
          ],
        };
      }),
    );
  };

  const handleAddCatalogueServiceToOption = (optId: string, svc: ServiceResponse) => {
    const defaultTooth = quotationTeeth[0] ?? examinedTeeth[0]?.tooth_number ?? null;
    setQuoteOptions((prev) =>
      prev.map((opt) => {
        if (opt.id !== optId) return opt;
        return {
          ...opt,
          items: [
            ...opt.items.filter((it) => it.procedure_name.trim() !== ''),
            {
              id: `opt-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              service_id: svc.id,
              procedure_name: svc.name,
              tooth_number: defaultTooth,
              quantity: 1,
              unit_price: svc.standard_price > 0 ? svc.standard_price : 0,
            },
          ],
        };
      }),
    );
  };

  const handleAddOption = () => {
    const nextLetter = String.fromCharCode(65 + quoteOptions.length); // A, B, C...
    const defaultTooth = quotationTeeth[0] ?? examinedTeeth[0]?.tooth_number ?? null;
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
            tooth_number: defaultTooth,
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
    const defaultTooth = quotationTeeth[0] ?? examinedTeeth[0]?.tooth_number ?? null;
    setQuoteOptions((prev) =>
      prev.map((opt) => {
        if (opt.id !== optId) return opt;
        return {
          ...opt,
          items: [
            ...opt.items,
            {
              id: `opt-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              procedure_name: '',
              tooth_number: defaultTooth,
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

  const handleSaveStage = async (
    planItemId: string,
    toothNum?: number | null,
    serviceId?: string | null,
  ) => {
    const targetEpisodeId = episodeId ?? effectiveEpisodeId;
    if (!targetEpisodeId || !newStageName.trim() || !newStageDoctorId) return;

    const activeLabOrder = episodeLabOrders.find(
      (lo) => lo.treatment_plan_item_id === planItemId && lo.status !== 'CANCELLED',
    );

    await createStageMutation.mutateAsync({
      episodeId: targetEpisodeId,
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

  const handleSelectService = (service: { id: string; name: string; standard_price: number }) => {
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
    const svc = catalogueServicesList.find((s) => s.id === serviceId);
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

    const parsedTooth = toothNumber ? Number(toothNumber) : null;
    if (parsedTooth !== null && !examinedTeethNumbers.includes(parsedTooth)) {
      return;
    }

    const resolvedServiceId =
      selectedServiceId && /^[a-f\d]{24}$/i.test(selectedServiceId)
        ? selectedServiceId
        : departmentServices.find(
            (s) => s.id === selectedServiceId || s.name.toLowerCase() === procedureName.trim().toLowerCase(),
          )?.id || null;

    const newItem: DentalTreatmentPlanItem = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      service_id: resolvedServiceId,
      tooth_number: parsedTooth,
      procedure_name: procedureName.trim(),
      surfaces: [],
      priority: 'ROUTINE',
      estimated_cost: estimatedCost !== '' && !isNaN(Number(estimatedCost)) ? Number(estimatedCost) : null,
      notes: notes.trim() || null,
      status: 'PROPOSED',
      depends_on_plan_item_id: dependsOnPlanItemId || null,
    };

    onChange([...items, newItem]);

    // Reset inputs
    setToothNumber('');
    setSelectedServiceId('');
    setProcedureName('');
    setEstimatedCost('');
    setNotes('');
    setDependsOnPlanItemId('');
    setShowAddTreatmentForm(false);
  };

  const handleRemoveItem = (identifier: string | number) => {
    if (disabled) return;
    if (typeof identifier === 'number') {
      onChange(items.filter((_, i) => i !== identifier));
    } else {
      onChange(items.filter((it, idx) => (it.id ? it.id !== identifier : `plan-item-${idx}` !== identifier)));
    }
  };

  const handleStatusChange = (identifier: string | number, newStatus: DentalTreatmentStatus) => {
    if (disabled) return;
    const updated = items.map((item, i) => {
      const matches = typeof identifier === 'number' ? i === identifier : (item.id === identifier || `plan-item-${i}` === identifier);
      return matches ? { ...item, status: newStatus } : item;
    });
    onChange(updated);
  };

  const handleAcceptItem = (identifier: string | number) => {
    handleStatusChange(identifier, 'ACCEPTED');
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
            Dental Treatment Plan
          </h3>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            ({items.length} Procedure{items.length === 1 ? '' : 's'})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
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
          {!disabled && (
            <button
              type="button"
              className={styles.btnPrimary}
              style={{
                fontSize: '0.78rem',
                padding: '4px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#7c3aed',
                borderColor: '#7c3aed',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowAddTreatmentForm((prev) => !prev);
              }}
              title={showAddTreatmentForm ? 'Close treatment form' : 'Add new treatment procedure'}
            >
              <i className={`ph ${showAddTreatmentForm ? 'ph-x' : 'ph-plus'}`} />
              {showAddTreatmentForm ? 'Close Form' : '+ Add Treatment'}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className={styles.cardContent}>
          {billingStateError ? (
            <div className={styles.billingError} role="alert">
              <i className="ph ph-warning-circle" /> {billingStateError}
            </div>
          ) : null}

          {/* Episode initiation prompt in treatment planning context */}
          {!episodeId && onStartEpisode && !disabled && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#475569' }}>
                <i className="ph ph-folder-plus" style={{ color: '#2563eb', fontSize: '1.2rem' }} />
                <span>Planning multi-visit or multi-stage dental procedures? Start a dedicated treatment episode.</span>
              </div>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                onClick={onStartEpisode}
              >
                <i className="ph ph-plus-circle" /> Start Treatment Episode
              </button>
            </div>
          )}

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
          </div>

          {/* Inline [+ Add Treatment] Form inside Dental Treatment Plan */}
          {!disabled && showAddTreatmentForm && (
            <div
              style={{
                marginTop: '12px',
                marginBottom: '16px',
                padding: '14px 16px',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #ddd6fe',
                boxShadow: '0 1px 3px rgba(124, 58, 237, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#6d28d9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ph ph-plus-circle" /> Add Dental Treatment Procedure
                </div>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                  onClick={() => setShowAddTreatmentForm(false)}
                  title="Close form"
                >
                  <i className="ph ph-x" />
                </button>
              </div>

              {/* Quick-add chips from Service Catalogue */}
              {catalogueServicesList.length > 0 && (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '8px 12px',
                    background: '#faf8ff',
                    border: '1px dashed #c4b5fd',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6d28d9', marginBottom: '6px' }}>
                    <i className="ph ph-lightning" /> Quick-Select from Service Catalogue:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {catalogueServicesList.map((svc) => (
                      <button
                        key={svc.id}
                        type="button"
                        className={styles.chip}
                        style={{ background: '#ede9fe', color: '#6d28d9', borderColor: '#ddd6fe', fontSize: '0.72rem', cursor: 'pointer' }}
                        onClick={() => handleSelectService(svc)}
                        title={svc.standard_price > 0 ? `Standard price: ${formatCurrency(svc.standard_price)}` : undefined}
                      >
                        {svc.name}
                        {svc.standard_price > 0 && (
                          <span style={{ fontSize: '0.675rem', opacity: 0.85, fontWeight: 700 }}>
                            {' '}· {formatCurrency(svc.standard_price)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleAddItem}>
                <div
                  className={styles.treatmentFormGrid}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: candidatePrerequisites.length > 0
                      ? '1.2fr 1.3fr 1.3fr 1.3fr 0.9fr 1.4fr auto'
                      : '1.3fr 1.5fr 1.4fr 0.9fr 1.4fr auto',
                    gap: '12px',
                    alignItems: 'end',
                    width: '100%',
                  }}
                >
                  {/* Tooth Selector */}
                  <div className={styles.formGroup} style={{ minWidth: 0 }}>
                    <label className={styles.label}>Tooth # (Examined Teeth)</label>
                    <select
                      className={styles.select}
                      value={toothNumber}
                      onChange={(e) => setToothNumber(e.target.value)}
                    >
                      <option value="">General / Full Mouth</option>
                      {examinedTeeth.length > 0 ? (
                        <optgroup label="Examined Teeth (Findings Recorded)">
                           {examinedTeeth.map((t) => {
                            const conditionList = [
                              t.status && t.status !== 'PRESENT' ? t.status : '',
                              ...(t.conditions || []),
                            ]
                              .filter(Boolean)
                              .map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase());
                            const conditionStr = Array.from(new Set(conditionList)).join(', ');
                            return (
                              <option key={t.tooth_number} value={t.tooth_number}>
                                Tooth #{t.tooth_number} — {TOOTH_NAMES[t.tooth_number] ?? getToothName(t.tooth_number)}
                                {conditionStr ? ` (${conditionStr})` : ''}
                              </option>
                            );
                          })}
                        </optgroup>
                      ) : (
                        <option value="" disabled>
                          No examined teeth available
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Service Catalogue Picker */}
                  <div className={styles.formGroup} style={{ minWidth: 0 }}>
                    <label className={styles.label}>Service Catalogue</label>
                    <select
                      className={styles.select}
                      value={selectedServiceId}
                      onChange={(e) => handleCatalogueDropdownChange(e.target.value)}
                    >
                      <option value="">-- Select from Catalogue --</option>
                      {catalogueServicesList.map((svc) => (
                        <option key={svc.id} value={svc.id}>
                          {svc.name} {svc.standard_price > 0 ? `(${formatCurrency(svc.standard_price)})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Procedure Name Input */}
                  <div className={styles.formGroup} style={{ minWidth: 0 }}>
                    <label className={styles.label}>
                      Procedure Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      list="dental-procedure-suggestions"
                      placeholder="e.g. Composite Restoration, RCT..."
                      className={styles.input}
                      value={procedureName}
                      onChange={(e) => {
                        setProcedureName(e.target.value);
                        const matchedSvc = catalogueServicesList.find(
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
                      {catalogueServicesList.map((svc) => (
                        <option key={svc.id} value={svc.name} />
                      ))}
                    </datalist>
                  </div>

                  {/* Prerequisite Procedure (Optional) */}
                  {candidatePrerequisites.length > 0 && (
                    <div className={styles.formGroup} style={{ minWidth: 0 }}>
                      <label className={styles.label}>Depends On</label>
                      <select
                        className={styles.select}
                        value={dependsOnPlanItemId}
                        onChange={(e) => setDependsOnPlanItemId(e.target.value)}
                        title="Select prerequisite procedure that must be COMPLETED before this procedure can be executed"
                      >
                        <option value="">None (Independent)</option>
                        {candidatePrerequisites.map((cand, cIdx) => (
                          <option key={cand.id ?? `cand-${cIdx}`} value={cand.id ?? cand.procedure_name}>
                            {cand.tooth_number ? `#${cand.tooth_number} ` : ''}
                            {cand.procedure_name} ({cand.status ?? 'PROPOSED'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}


                  {/* Est. Cost */}
                  <div className={styles.formGroup} style={{ minWidth: 0 }}>
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
                  <div className={styles.formGroup} style={{ minWidth: 0 }}>
                    <label className={styles.label}>Treatment Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Shade A2, post & core..."
                      className={styles.input}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Submit Button */}
                  <div style={{ alignSelf: 'end', minWidth: 'max-content', display: 'flex', gap: '6px' }}>
                    <button
                      type="submit"
                      className={styles.btnPrimary}
                      style={{
                        height: '36px',
                        whiteSpace: 'nowrap',
                        padding: '0 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#7c3aed',
                        borderColor: '#7c3aed',
                      }}
                    >
                      <i className="ph ph-plus" /> Add Treatment
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Unified Dental Treatment Plan Table */}
          {items.length === 0 ? (
            <div
              style={{
                padding: '24px 20px',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
                fontSize: '0.85rem',
                marginTop: '12px',
              }}
            >
              <i className="ph ph-tooth" style={{ fontSize: '1.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }} />
              No dental treatment procedures planned yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table className={styles.treatmentTable}>
                <thead>
                  <tr>
                    <th style={{ width: '100px' }}>Site / Tooth</th>
                    <th>Procedure Name &amp; Multi-Doctor Stages</th>
                    <th style={{ width: '110px' }}>Est. Cost</th>
                    <th style={{ width: '140px' }}>Status</th>
                    <th>Clinical Notes</th>
                    <th style={{ minWidth: '170px' }}>Billing</th>
                    {!disabled && <th style={{ width: '80px', textAlign: 'center' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const billingState = item.id ? billingStateByTreatmentItem.get(item.id) : undefined;
                    const cataloguePrice = item.service_id
                      ? departmentServices.find((service) => service.id === item.service_id)?.standard_price
                      : undefined;
                    const isPersisted = Boolean(item.id && /^[a-f\d]{24}$/i.test(item.id));
                    const isAcceptedOrActive = item.status === 'ACCEPTED' || item.status === 'IN_PROGRESS' || item.status === 'COMPLETED';
                    const isProposed = item.status === 'PROPOSED' || !item.status;
                    const isInactive = item.status === 'DECLINED' || item.status === 'CANCELLED';
                    const isStatusBillable = item.status !== 'DECLINED' && item.status !== 'CANCELLED' && item.status !== 'PROPOSED';
                    const isBillingThisItem = billingTreatmentItemPending === item.id;

                    const itemStages = (item.id ? stagesByPlanItem.get(item.id) : undefined) ?? [];
                    const isStagesExpanded = Boolean(item.id && expandedStageRows.has(item.id));
                    const isAddingStage = Boolean(item.id && addingStageForItem === item.id);

                    return (
                      <React.Fragment key={item.id ?? `plan-item-${idx}`}>
                        <tr style={isInactive ? { opacity: 0.65 } : undefined}>
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
                              {/* Stages management indicator / toggle for accepted/active items */}
                              {isAcceptedOrActive && (
                                isPersisted ? (
                                  <button
                                    type="button"
                                    className={styles.chip}
                                    style={{
                                      cursor: 'pointer',
                                      fontSize: '0.725rem',
                                      background: itemStages.length > 0 ? '#eff6ff' : '#f8fafc',
                                      color: itemStages.length > 0 ? '#1d4ed8' : '#64748b',
                                      borderColor: itemStages.length > 0 ? '#bfdbfe' : '#cbd5e1',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '2px 8px',
                                      fontWeight: itemStages.length > 0 ? 600 : 500,
                                    }}
                                    onClick={() => item.id && toggleStageRow(item.id)}
                                    title={
                                      itemStages.length > 0
                                        ? 'Toggle sequential treatment stages'
                                        : 'Manage treatment stages for this procedure'
                                    }
                                  >
                                    <i className="ph ph-git-merge" />
                                    {itemStages.length > 0 ? `Stages (${itemStages.length})` : 'Stages available'}
                                    <i className={`ph ph-caret-down ${isStagesExpanded ? styles.collapseChevronExpanded : ''}`} />
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '0.725rem',
                                      color: '#15803d',
                                      background: '#f0fdf4',
                                      border: '1px solid #bbf7d0',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      fontWeight: 500,
                                    }}
                                  >
                                    <i className="ph ph-check-circle" /> Stages available
                                  </span>
                                )
                              )}
                              {isProposed && (
                                <span
                                  style={{
                                    fontSize: '0.725rem',
                                    color: '#6d28d9',
                                    background: '#f5f3ff',
                                    border: '1px solid #ddd6fe',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontWeight: 500,
                                  }}
                                >
                                  <i className="ph ph-lock" /> Stages unlock upon acceptance
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {cataloguePrice != null
                              ? formatCurrency(cataloguePrice)
                              : item.estimated_cost != null
                              ? formatCurrency(item.estimated_cost)
                              : '—'}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                ...getStatusBadgeStyle(item.status),
                              }}
                            >
                              {item.status ?? 'PROPOSED'}
                            </span>
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
                            ) : isProposed ? (
                              <span className={styles.billingMuted}>Awaiting acceptance</span>
                            ) : isInactive ? (
                              <span className={styles.billingMuted}>Not billable</span>
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
                                  onClick={() => handleRemoveItem(item.id ?? idx)}
                                  title="Remove procedure"
                                >
                                  <i className="ph ph-trash" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Nested Multi-Doctor Stages Drawer */}
                        {isStagesExpanded && item.id && isAcceptedOrActive && (
                            <tr>
                              <td colSpan={disabled ? 6 : 7} style={{ padding: 0 }}>
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
                                    <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                                        No treatment stages created yet. Break this procedure down into sequential clinical steps (e.g. for RCT: Access &amp; Pulp Extirpation, Canal Shaping, Obturation; for Crown: Prep &amp; Impression, Fitting).
                                      </div>
                                      {!disabled && (
                                        <div>
                                          <button
                                            type="button"
                                            className={styles.btnSecondary}
                                            style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            onClick={() => handleOpenAddStage(item.id!)}
                                          >
                                            <i className="ph ph-plus" /> Manage Stages
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className={styles.stagesTimeline}>
                                    {itemStages.map((stage) => {
                                      const isStageCompatible = isStageClinicallyCompatible(item.procedure_name, stage.stage_name);
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

                                      // Check if prior compatible non-cancelled stages are completed
                                      const priorIncomplete = itemStages
                                        .filter(
                                          (s) =>
                                            s.sequence < stage.sequence &&
                                            s.status !== 'CANCELLED' &&
                                            isStageClinicallyCompatible(item.procedure_name, s.stage_name),
                                        )
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
                                                  ? styles.stageSeqCompleted
                                                  : isInProgress
                                                  ? styles.stageSeqInProgress
                                                  : ''
                                              }`}
                                            >
                                              {isCompleted ? <i className="ph ph-check" /> : stage.sequence}
                                            </div>

                                            <div className={styles.stageDetails}>
                                              <div className={styles.stageTitleRow}>
                                                <span className={styles.stageName}>{stage.stage_name}</span>
                                                {!isStageCompatible && (
                                                  <span
                                                    style={{
                                                      fontSize: '0.675rem',
                                                      fontWeight: 700,
                                                      color: '#dc2626',
                                                      background: '#fee2e2',
                                                      padding: '1px 6px',
                                                      borderRadius: '3px',
                                                      border: '1px solid #fca5a5',
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '3px',
                                                    }}
                                                    title={`This stage does not belong to procedure "${item.procedure_name}". Only compatible clinical stages should be executed.`}
                                                  >
                                                    <i className="ph ph-warning-circle" /> Procedure mismatch
                                                  </span>
                                                )}
                                              </div>

                                              <div className={styles.stageMeta}>
                                                <span className={styles.stageDoctor}>
                                                  <i className="ph ph-user" /> {formatDoctorName(stage.assigned_doctor_name)}
                                                </span>
                                                {stage.tooth_number && (
                                                  <span className={styles.stageTooth}>
                                                    <i className="ph ph-tooth" /> #{stage.tooth_number}
                                                  </span>
                                                )}
                                                {stage.planned_date && (
                                                  <span className={styles.stageDate}>
                                                    <i className="ph ph-calendar" /> Planned: {stage.planned_date}
                                                  </span>
                                                )}
                                                {stage.appointment_id && (
                                                  <span
                                                    className={styles.stageApptBadge}
                                                    title="Appointment linked"
                                                  >
                                                    <i className="ph ph-calendar-check" /> Appt Scheduled
                                                  </span>
                                                )}
                                              </div>

                                              {stage.notes && (
                                                <div className={styles.stageNotes}>
                                                  <i className="ph ph-note" /> {stage.notes}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className={styles.stageActions}>
                                            <span
                                              style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
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
                                                {/* PLANNED: Only Schedule and Delete are available. Strictly no Start or Complete. */}
                                                {stage.status === 'PLANNED' && (
                                                  <>
                                                    {!priorIncomplete ? (
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
                                                    ) : (
                                                      <span className={styles.stagePrereqNotice}>
                                                        <i className="ph ph-lock-key" /> Prior stage pending
                                                      </span>
                                                    )}

                                                    <button
                                                      type="button"
                                                      className={`${styles.btnStageAction} ${styles.btnStageDelete}`}
                                                      onClick={() => deleteStageMutation.mutate(stage.id)}
                                                      title="Delete planned stage"
                                                    >
                                                      <i className="ph ph-trash" />
                                                    </button>
                                                  </>
                                                )}

                                                {/* SCHEDULED: Start is available once scheduled with appointment. View, Reschedule, Cancel. Strictly no Complete. */}
                                                {stage.status === 'SCHEDULED' && (
                                                  <>
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
                                                          : 'Start treatment stage'
                                                      }
                                                      data-testid={`stage-${stage.sequence}-start-btn`}
                                                    >
                                                      <i className="ph ph-play" /> Start
                                                    </button>

                                                    {stage.appointment_id ? (
                                                      <>
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
                                                    ) : (
                                                      <button
                                                        type="button"
                                                        className={styles.btnStageAction}
                                                        style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                                                        onClick={() => setScheduleModalStage(stage)}
                                                        title="Schedule an appointment for this stage"
                                                        data-testid={`stage-${stage.sequence}-schedule-btn`}
                                                      >
                                                        <i className="ph ph-calendar-plus" /> Schedule
                                                      </button>
                                                    )}
                                                  </>
                                                )}

                                                {/* IN_PROGRESS: Complete and Hold available. Strictly no Start. */}
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

                                                {/* ON_HOLD: Resume available */}
                                                {stage.status === 'ON_HOLD' && (
                                                  <button
                                                    type="button"
                                                    className={`${styles.btnStageAction} ${styles.btnStageStart}`}
                                                    onClick={() =>
                                                      updateStageStatusMutation.mutate({
                                                        stageId: stage.id,
                                                        payload: { status: stage.appointment_id ? 'IN_PROGRESS' : 'SCHEDULED' },
                                                      })
                                                    }
                                                  >
                                                    <i className="ph ph-play" /> Resume
                                                  </button>
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
                                                        {formatDoctorName(doc.display_name || `${doc.first_name} ${doc.last_name}`)} ({doc.specialization || 'Dental'})
                                                      </option>
                                                    ))}
                                                  </select>
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
                                        <i className="ph ph-plus-circle" /> Add New Treatment Stage for "{item.procedure_name}" (Step {itemStages.length + 1})
                                      </div>

                                      {/* Quick stage suggestions contextual to procedure */}
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                        {getProcedureStageSuggestions(item.procedure_name).map((suggestion) => (
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
                                                {formatDoctorName(doc.display_name || `${doc.first_name} ${doc.last_name}`)} ({doc.specialization || 'Dental'})
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
                  })}
                </tbody>
              </table>
            </div>
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
      <div className={styles.quotationModalOverlay} role="dialog" aria-modal="true" aria-label="Generate Treatment Quotation">
        <div className={styles.quotationModalCard}>
          {/* 1. FIXED HEADER */}
          <div className={styles.quotationModalHeader}>
            <div className={styles.quotationModalTitleGroup}>
              <h3 className={styles.quotationModalTitle}>
                <i className="ph ph-receipt" style={{ color: '#0284c7' }} /> Generate Treatment Quotation
              </h3>
              {(patientName || episodeNumber || quotationTeeth.length > 0) && (
                <div className={styles.quotationContextBadges}>
                  {patientName && (
                    <span className={styles.quotationContextBadge} title="Patient">
                      <i className="ph ph-user" /> {patientName}
                    </span>
                  )}
                  {episodeNumber && (
                    <span className={styles.quotationContextBadge} title="Treatment Episode">
                      <i className="ph ph-hash" /> Episode #{episodeNumber}
                    </span>
                  )}
                  {quotationTeeth.length > 0 && (
                    <span className={styles.quotationContextBadge} title="Target Teeth">
                      <i className="ph ph-tooth" /> Tooth #{quotationTeeth.join(', #')} ({quotationTeeth.map((tn) => TOOTH_NAMES[tn] ?? getToothName(tn)).join(', ')})
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setShowQuotationModal(false)}
              aria-label="Close"
              title="Close modal"
            >
              <i className="ph ph-x" />
            </button>
          </div>

          {/* 2. SCROLLABLE BODY */}
          <div className={styles.quotationModalBody}>
            {/* Treatment Options Section */}
            <div className={styles.quotationOptionsSection}>
              <div className={styles.quotationOptionsHeader}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ph ph-rows" style={{ color: '#0284c7' }} /> Treatment Options ({quoteOptions.length})
                </h4>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ fontSize: '0.8rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  onClick={handleAddOption}
                >
                  <i className="ph ph-plus" /> Add Option
                </button>
              </div>

              {quoteOptions.map((opt, optIdx) => {
                const optSubtotal = opt.items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);
                const optDisc = parseFloat(opt.discount_amount) || 0;
                const optTax = parseFloat(opt.tax_amount) || 0;
                const optTotal = Math.max(0, optSubtotal - optDisc + optTax);

                return (
                  <div key={opt.id} className={styles.quotationOptionCard}>
                    <div className={styles.quotationOptionTopBar}>
                      <div className={styles.quotationOptionFields}>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Option Name</label>
                          <input
                            type="text"
                            className={styles.input}
                            value={opt.name}
                            onChange={(e) => handleOptionChange(opt.id, 'name', e.target.value)}
                            placeholder={`e.g. Option ${String.fromCharCode(65 + optIdx)} – Recommended RCT`}
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
                          style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '6px 10px', marginTop: '22px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleRemoveOption(opt.id)}
                          title="Remove Option"
                        >
                          <i className="ph ph-trash" /> Remove Option
                        </button>
                      )}
                    </div>

                    {/* Quick-add proposed or catalogue items into this option */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                      {proposedItems.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                            + Add Proposed:
                          </span>
                          {proposedItems.map((pi, idx) => (
                            <button
                              key={pi.id ?? idx}
                              type="button"
                              className={styles.chip}
                              style={{ fontSize: '0.7rem', background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0', cursor: 'pointer' }}
                              onClick={() => handleAddProposedItemToOption(opt.id, pi)}
                              title="Add this proposed treatment to option"
                            >
                              + {pi.tooth_number ? `#${pi.tooth_number} ` : ''}{pi.procedure_name}
                            </button>
                          ))}
                        </div>
                      )}

                      {departmentServices.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                            + Add Catalogue:
                          </span>
                          <select
                            className={styles.select}
                            style={{ fontSize: '0.72rem', padding: '2px 6px', maxWidth: '180px' }}
                            value=""
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const svc = departmentServices.find((s) => s.id === e.target.value);
                              if (svc) handleAddCatalogueServiceToOption(opt.id, svc);
                              e.target.value = '';
                            }}
                          >
                            <option value="">-- Choose Procedure --</option>
                            {departmentServices.map((svc) => (
                              <option key={svc.id} value={svc.id}>
                                {svc.name} ({formatCurrency(svc.standard_price)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Items table for this option */}
                    <div className={styles.quotationOptionTableContainer}>
                      <table className={styles.quotationOptionTable}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', width: '42%' }}>Procedure</th>
                            <th style={{ textAlign: 'center', width: '14%' }}>Tooth #</th>
                            <th style={{ textAlign: 'center', width: '10%' }}>Qty</th>
                            <th style={{ textAlign: 'right', width: '15%' }}>Unit Price</th>
                            <th style={{ textAlign: 'right', width: '13%' }}>Total</th>
                            <th style={{ textAlign: 'center', width: '6%' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {opt.items.map((item) => {
                            const lineTotal = item.quantity * item.unit_price;
                            const isInherited = Boolean(item.treatment_plan_item_id);
                            return (
                              <tr key={item.id}>
                                <td>
                                  {isInherited ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{item.procedure_name}</strong>
                                      <span
                                        style={{
                                          fontSize: '0.68rem',
                                          padding: '1px 6px',
                                          background: '#e0e7ff',
                                          color: '#3730a3',
                                          borderRadius: '4px',
                                          fontWeight: 600,
                                          whiteSpace: 'nowrap',
                                        }}
                                        title="Inherited directly from Treatment Plan"
                                      >
                                        Plan
                                      </span>
                                    </div>
                                  ) : (
                                    <div>
                                      <input
                                        type="text"
                                        list={`proc-sugg-${opt.id}-${item.id}`}
                                        className={styles.input}
                                        style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                        value={item.procedure_name}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const matched = departmentServices.find((s) => s.name.toLowerCase() === val.trim().toLowerCase());
                                          handleOptionItemChange(opt.id, item.id, 'procedure_name', val);
                                          if (matched) {
                                            handleOptionItemChange(opt.id, item.id, 'service_id', matched.id);
                                            if (matched.standard_price >= 0) {
                                              handleOptionItemChange(opt.id, item.id, 'unit_price', matched.standard_price);
                                            }
                                          }
                                        }}
                                        placeholder="Select or enter procedure"
                                      />
                                      <datalist id={`proc-sugg-${opt.id}-${item.id}`}>
                                        {departmentServices.map((s) => (
                                          <option key={s.id} value={s.name} />
                                        ))}
                                        {COMMON_DENTAL_PROCEDURES.map((p) => (
                                          <option key={p} value={p} />
                                        ))}
                                      </datalist>
                                    </div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {isInherited ? (
                                    <span
                                      className={styles.chip}
                                      style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        background: '#f8fafc',
                                        color: '#334155',
                                        borderColor: '#cbd5e1',
                                        padding: '2px 8px',
                                        display: 'inline-block',
                                      }}
                                    >
                                      {item.tooth_number ? `#${item.tooth_number}` : 'Full Mouth'}
                                    </span>
                                  ) : (
                                    <select
                                      className={styles.select}
                                      style={{ fontSize: '0.78rem', padding: '3px 6px', textAlign: 'center', width: '100%' }}
                                      value={item.tooth_number ?? ''}
                                      onChange={(e) =>
                                        handleOptionItemChange(
                                          opt.id,
                                          item.id,
                                          'tooth_number',
                                          e.target.value ? parseInt(e.target.value, 10) : null,
                                        )
                                      }
                                    >
                                      <option value="">Full Mouth</option>
                                      {examinedTeeth.map((t) => (
                                        <option key={t.tooth_number} value={t.tooth_number}>
                                          #{t.tooth_number}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    className={styles.input}
                                    style={{ textAlign: 'center', fontSize: '0.8rem', padding: '4px 6px' }}
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
                                <td style={{ textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={styles.input}
                                    style={{ textAlign: 'right', fontSize: '0.8rem', padding: '4px 8px' }}
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
                                <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                                  {formatCurrency(lineTotal)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {opt.items.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOptionItem(opt.id, item.id)}
                                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                                      title="Delete item"
                                    >
                                      <i className="ph ph-trash" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className={styles.quotationOptionBottomBar}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleAddOptionItem(opt.id)}
                      >
                        <i className="ph ph-plus" /> Add Item
                      </button>

                      <div className={styles.quotationOptionTotals}>
                        <div className={styles.quotationOptionTotalsField}>
                          <span>Discount:</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={opt.discount_amount}
                            onChange={(e) => handleOptionChange(opt.id, 'discount_amount', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className={styles.quotationOptionTotalsField}>
                          <span>Tax:</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={opt.tax_amount}
                            onChange={(e) => handleOptionChange(opt.id, 'tax_amount', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className={styles.quotationOptionTotalBadge}>
                          Total: <span>{formatCurrency(optTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quotation Details (Compact) */}
            <div className={styles.quotationDetailsCompact}>
              <div className={styles.quotationDetailsCompactHeader}>
                <i className="ph ph-sliders" style={{ color: '#0284c7' }} />
                <span>Quotation Details</span>
              </div>
              <div className={styles.quotationDetailsCompactFields}>
                <div className={styles.quotationDetailsCompactField}>
                  <label>Valid Until (Optional)</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={quoteValidUntil}
                    onChange={(e) => setQuoteValidUntil(e.target.value)}
                  />
                </div>
                <div className={styles.quotationDetailsCompactField} style={{ flex: 1 }}>
                  <label>Quotation Notes (Optional)</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="e.g. Valid for 30 days, includes post-op check"
                  />
                </div>
              </div>
            </div>

            {/* Comparison Overview Card */}
            <div className={styles.quotationSummaryCard}>
              <div className={styles.quotationSummaryTitle}>
                <i className="ph ph-chart-bar" /> Options Comparison Overview
              </div>
              <div className={styles.quotationSummaryGrid}>
                {quoteOptions.map((opt, idx) => {
                  const optSub = opt.items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);
                  const optDisc = parseFloat(opt.discount_amount) || 0;
                  const optTax = parseFloat(opt.tax_amount) || 0;
                  const optTot = Math.max(0, optSub - optDisc + optTax);
                  return (
                    <div key={opt.id} className={styles.quotationSummaryItem}>
                      <div className={styles.quotationSummaryItemName}>
                        {opt.name || `Option ${String.fromCharCode(65 + idx)}`}
                      </div>
                      <div className={styles.quotationSummaryItemValue}>
                        {formatCurrency(optTot)}
                      </div>
                      <div className={styles.quotationSummaryItemCount}>
                        {opt.items.length} {opt.items.length === 1 ? 'procedure' : 'procedures'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. FIXED FOOTER */}
          <div className={styles.quotationModalFooter}>
            <div className={styles.quotationFooterInfo}>
              <i className="ph ph-info" style={{ color: '#0284c7' }} />
              <span>Draft quotations are non-binding estimates until accepted.</span>
            </div>
            <div className={styles.quotationFooterActions}>
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
      </div>
    )}

    {/* View Quotation Details / Decision Modal */}
    {selectedQuotation && (
      <div className={styles.quotationModalOverlay} role="dialog" aria-modal="true" aria-label="Quotation Details">
        <div className={styles.quotationModalCard}>
          {/* 1. FIXED HEADER */}
          <div className={styles.quotationModalHeader}>
            <div className={styles.quotationModalTitleGroup}>
              <h3 className={styles.quotationModalTitle}>
                <i className="ph ph-file-text" style={{ color: '#0284c7' }} /> Quotation #{selectedQuotation.quotation_number}
              </h3>
              <p className={styles.quotationModalSubtitle}>
                Dental Treatment Quotation
              </p>
              {(patientName || episodeNumber || primaryToothNumber) && (
                <div className={styles.quotationContextBadges}>
                  {patientName && (
                    <span className={styles.quotationContextBadge} title="Patient">
                      <i className="ph ph-user" /> {patientName}
                    </span>
                  )}
                  {episodeNumber && (
                    <span className={styles.quotationContextBadge} title="Treatment Episode">
                      <i className="ph ph-hash" /> Episode #{episodeNumber}
                    </span>
                  )}
                  {primaryToothNumber && (
                    <span className={styles.quotationContextBadge} title="Primary Tooth">
                      <i className="ph ph-tooth" /> Tooth #{primaryToothNumber} ({getToothName(primaryToothNumber)})
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => {
                setSelectedQuotation(null);
                setDecisionMode('view');
                setDecisionReasonInput('');
              }}
              aria-label="Close"
              title="Close modal"
            >
              <i className="ph ph-x" />
            </button>
          </div>

          {/* 2. SCROLLABLE BODY */}
          <div className={styles.quotationModalBody}>
            {/* Status Banners */}
            {selectedQuotation.status === 'ACCEPTED' && (
              <div
                style={{
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '12px 16px',
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

            {/* Quotation Summary Card */}
            <div className={styles.quotationCard}>
              <div className={styles.quotationCardHeader}>
                <h4 className={styles.quotationCardTitle}>
                  <i className="ph ph-info" /> Quotation Summary
                </h4>
              </div>
              <div className={styles.quotationSummaryMetaGrid}>
                <div className={styles.quotationSummaryMetaItem}>
                  <span className={styles.quotationSummaryMetaLabel}>Status</span>
                  <div>
                    <span
                      className={`${styles.quotationStatusBadge} ${
                        selectedQuotation.status === 'ACCEPTED'
                          ? styles.quotationStatusBadgeAccepted
                          : selectedQuotation.status === 'REJECTED'
                          ? styles.quotationStatusBadgeRejected
                          : selectedQuotation.status === 'SENT'
                          ? styles.quotationStatusBadgeSent
                          : selectedQuotation.status === 'POSTPONED'
                          ? styles.quotationStatusBadgePostponed
                          : styles.quotationStatusBadgeDraft
                      }`}
                    >
                      ● {selectedQuotation.status}
                    </span>
                  </div>
                </div>

                <div className={styles.quotationSummaryMetaItem}>
                  <span className={styles.quotationSummaryMetaLabel}>Doctor</span>
                  <span className={styles.quotationSummaryMetaValue}>
                    {selectedQuotation.doctor_name || '—'}
                  </span>
                </div>

                <div className={styles.quotationSummaryMetaItem}>
                  <span className={styles.quotationSummaryMetaLabel}>Created</span>
                  <span className={styles.quotationSummaryMetaValue}>
                    {new Date(selectedQuotation.created_at).toLocaleString()}
                  </span>
                </div>

                {selectedQuotation.sent_at && (
                  <div className={styles.quotationSummaryMetaItem}>
                    <span className={styles.quotationSummaryMetaLabel}>Sent</span>
                    <span className={styles.quotationSummaryMetaValue}>
                      {new Date(selectedQuotation.sent_at).toLocaleString()}
                    </span>
                  </div>
                )}

                {selectedQuotation.valid_until && (
                  <div className={styles.quotationSummaryMetaItem}>
                    <span className={styles.quotationSummaryMetaLabel}>Valid Until</span>
                    <span className={styles.quotationSummaryMetaValue}>
                      {new Date(selectedQuotation.valid_until).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {selectedQuotation.notes && (
                  <div className={styles.quotationSummaryMetaItem} style={{ gridColumn: '1 / -1' }}>
                    <span className={styles.quotationSummaryMetaLabel}>Notes</span>
                    <span className={styles.quotationSummaryMetaValue} style={{ fontWeight: 400 }}>
                      {selectedQuotation.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Presented Treatment Options Section */}
            {selectedQuotation.options && selectedQuotation.options.length > 0 ? (
              <div className={styles.quotationOptionsSection}>
                <div className={styles.quotationOptionsHeader}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ph ph-rows" style={{ color: '#0284c7' }} /> Presented Treatment Options ({selectedQuotation.options.length})
                  </h4>
                </div>

                {(selectedQuotation.status === 'SENT' || selectedQuotation.status === 'POSTPONED') && (
                  <div className={styles.quotationInstructionBanner}>
                    <i className="ph ph-hand-pointing" />
                    <span>Select an option below to accept and continue.</span>
                  </div>
                )}

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
                      className={`${styles.quotationDecisionOptionCard} ${
                        canSelect ? styles.quotationDecisionOptionCardSelectable : ''
                      } ${isSelected ? styles.quotationDecisionOptionCardSelected : ''}`}
                    >
                      <div className={styles.quotationDecisionOptionHeader}>
                        <div className={styles.quotationDecisionOptionNameRow}>
                          {canSelect && (
                            <input
                              type="radio"
                              name="decisionOptionRadio"
                              className={styles.quotationDecisionOptionRadio}
                              checked={selectedDecisionOptionId === opt.id}
                              onChange={() => opt.id && setSelectedDecisionOptionId(opt.id)}
                            />
                          )}
                          <span className={styles.quotationDecisionOptionTitle}>
                            {opt.name}
                          </span>
                          {selectedQuotation.status === 'ACCEPTED' && selectedQuotation.selected_option_id === opt.id && (
                            <span
                              style={{
                                background: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #86efac',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              ✓ ACCEPTED OPTION
                            </span>
                          )}
                        </div>
                        <span className={styles.quotationDecisionOptionTotalBadge}>
                          {formatCurrency(opt.total ?? 0)}
                        </span>
                      </div>

                      {opt.description && (
                        <p className={styles.quotationDecisionOptionDesc}>
                          {opt.description}
                        </p>
                      )}

                      {/* Items table */}
                      <div className={styles.quotationOptionTableContainer}>
                        <table className={styles.quotationOptionTable}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', width: '38px' }}>#</th>
                              <th style={{ textAlign: 'left' }}>Procedure</th>
                              <th style={{ textAlign: 'center', width: '90px' }}>Tooth</th>
                              <th style={{ textAlign: 'center', width: '60px' }}>Qty</th>
                              <th style={{ textAlign: 'right', width: '120px' }}>Unit Price</th>
                              <th style={{ textAlign: 'right', width: '120px' }}>Line Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(opt.items ?? []).map((it, idx) => (
                              <tr key={it.id ?? idx}>
                                <td style={{ color: '#64748b' }}>{idx + 1}</td>
                                <td style={{ fontWeight: 600 }}>{it.procedure_name}</td>
                                <td style={{ textAlign: 'center', color: '#64748b' }}>
                                  {it.tooth_number ? `Tooth #${it.tooth_number}` : 'General'}
                                </td>
                                <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(it.unit_price ?? 0)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                                  {formatCurrency(it.line_total ?? (it.unit_price ?? 0) * (it.quantity ?? 1))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Financial breakdown */}
                      <div className={styles.quotationFinancialSummary}>
                        <div className={styles.quotationFinancialRow}>
                          <span>Subtotal:</span>
                          <span>{formatCurrency(opt.subtotal ?? 0)}</span>
                        </div>
                        {(opt.discount_amount ?? 0) > 0 && (
                          <div className={styles.quotationFinancialRow} style={{ color: '#16a34a' }}>
                            <span>Discount:</span>
                            <span>-{formatCurrency(opt.discount_amount ?? 0)}</span>
                          </div>
                        )}
                        {(opt.tax_amount ?? 0) > 0 && (
                          <div className={styles.quotationFinancialRow}>
                            <span>Tax:</span>
                            <span>+{formatCurrency(opt.tax_amount ?? 0)}</span>
                          </div>
                        )}
                        <div className={styles.quotationFinancialTotal}>
                          <span>Option Total:</span>
                          <span style={{ color: '#0284c7' }}>{formatCurrency(opt.total ?? 0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Legacy single items list
              <div className={styles.quotationCard}>
                <div className={styles.quotationCardHeader}>
                  <h4 className={styles.quotationCardTitle}>
                    <i className="ph ph-list" /> Treatment Items
                  </h4>
                </div>
                <div className={styles.quotationOptionTableContainer} style={{ marginBottom: 12 }}>
                  <table className={styles.quotationOptionTable}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', width: '38px' }}>#</th>
                        <th style={{ textAlign: 'left' }}>Procedure</th>
                        <th style={{ textAlign: 'center', width: '90px' }}>Tooth</th>
                        <th style={{ textAlign: 'center', width: '60px' }}>Qty</th>
                        <th style={{ textAlign: 'right', width: '120px' }}>Unit Price</th>
                        <th style={{ textAlign: 'right', width: '120px' }}>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedQuotation.items.map((it, idx) => (
                        <tr key={it.id ?? idx}>
                          <td style={{ color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{it.procedure_name}</td>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>
                            {it.tooth_number ? `Tooth #${it.tooth_number}` : 'General'}
                          </td>
                          <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(it.unit_price)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                            {formatCurrency(it.line_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.quotationFinancialSummary}>
                  <div className={styles.quotationFinancialRow}>
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedQuotation.subtotal)}</span>
                  </div>
                  {selectedQuotation.discount_amount > 0 && (
                    <div className={styles.quotationFinancialRow} style={{ color: '#16a34a' }}>
                      <span>Discount:</span>
                      <span>-{formatCurrency(selectedQuotation.discount_amount)}</span>
                    </div>
                  )}
                  {selectedQuotation.tax_amount > 0 && (
                    <div className={styles.quotationFinancialRow}>
                      <span>Tax:</span>
                      <span>+{formatCurrency(selectedQuotation.tax_amount)}</span>
                    </div>
                  )}
                  <div className={styles.quotationFinancialTotal}>
                    <span>Grand Total:</span>
                    <span style={{ color: '#0284c7' }}>{formatCurrency(selectedQuotation.total)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Reject / Postpone Reason Inputs */}
            {decisionMode === 'reject' && (
              <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
                <label className={styles.label} style={{ color: '#991b1b', fontWeight: 600 }}>
                  Reason for Rejection (Optional)
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Patient prefers conservative observation or seeks second opinion"
                  value={decisionReasonInput}
                  onChange={(e) => setDecisionReasonInput(e.target.value)}
                  style={{ marginTop: '6px' }}
                />
              </div>
            )}

            {decisionMode === 'postpone' && (
              <div style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                <label className={styles.label} style={{ color: '#334155', fontWeight: 600 }}>
                  Postponement Remark (Optional)
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Decision postponed pending family discussion or insurance verification"
                  value={decisionReasonInput}
                  onChange={(e) => setDecisionReasonInput(e.target.value)}
                  style={{ marginTop: '6px' }}
                />
              </div>
            )}
          </div>

          {/* 3. FIXED FOOTER */}
          <div className={styles.quotationModalFooter}>
            {/* Left side actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => setDecisionMode('view')}
                    >
                      Back
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Right side actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setSelectedQuotation(null);
                  setDecisionMode('view');
                  setDecisionReasonInput('');
                }}
              >
                Close
              </button>

              {/* DRAFT: Send to Patient button */}
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

              {/* SENT / POSTPONED: Accept Option / Confirm Buttons */}
              {(selectedQuotation.status === 'SENT' || selectedQuotation.status === 'POSTPONED') && !disabled && (
                <>
                  {decisionMode === 'view' && (
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      style={{ background: '#16a34a', borderColor: '#16a34a' }}
                      disabled={
                        acceptQuotationMutation.isPending ||
                        (!selectedDecisionOptionId &&
                          Boolean(selectedQuotation.options && selectedQuotation.options.length > 0))
                      }
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
                  )}

                  {decisionMode === 'reject' && (
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
                  )}

                  {decisionMode === 'postpone' && (
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
                  )}
                </>
              )}
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
