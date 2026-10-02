import type { DentalTreatmentStage } from './dental-stage.types.js';
import type { DentalTreatmentPlanItem } from './opd-dental-examination.types.js';
import type { DentalTreatmentPlanItemFields } from './opd-dental-examination.model.js';

export type DentalProcedureDependencyRule = {
  /** Prerequisite procedure name (case-insensitive substring or exact match) */
  prerequisiteProcedureName?: string;
  /** Prerequisite service catalogue ID */
  prerequisiteServiceId?: string;
  /** Dependent procedure name (case-insensitive substring or exact match) */
  dependentProcedureName?: string;
  /** Dependent service catalogue ID */
  dependentServiceId?: string;
};

// Configurable generic rules registry
const globalDependencyRules: DentalProcedureDependencyRule[] = [];

/**
 * Register a generic procedure dependency rule for testing or environment configuration.
 * e.g. registerDentalProcedureDependencyRule({ prerequisiteProcedureName: 'Test_Proc_A', dependentProcedureName: 'Test_Proc_B' })
 */
export function registerDentalProcedureDependencyRule(rule: DentalProcedureDependencyRule): void {
  globalDependencyRules.push(rule);
}

/**
 * Clear registered dependency rules (useful for test isolation).
 */
export function clearDentalProcedureDependencyRules(): void {
  globalDependencyRules.length = 0;
}

export type ProcedureDependencyEvaluationResult = {
  isBlocked: boolean;
  prerequisiteProcedureName?: string | null;
  prerequisitePlanItemId?: string | null;
  reason?: string | null;
};

type GenericPlanItem = (DentalTreatmentPlanItem | DentalTreatmentPlanItemFields) & {
  _id?: unknown;
  id?: string;
  serviceId?: string | null;
  service_id?: string | null;
  toothNumber?: number | null;
  tooth_number?: number | null;
  procedureName?: string;
  procedure_name?: string;
  status?: string;
  dependsOnPlanItemId?: string | null;
  depends_on_plan_item_id?: string | null;
};

function getItemId(item: GenericPlanItem): string | null {
  if (item.id) return item.id.toString();
  if (item._id) return item._id.toString();
  return null;
}

function getItemProcedureName(item: GenericPlanItem): string {
  return (item.procedure_name ?? item.procedureName ?? '').trim();
}

function getItemServiceId(item: GenericPlanItem): string | null {
  return item.service_id ?? item.serviceId ?? null;
}

function getItemToothNumber(item: GenericPlanItem): number | null {
  return item.tooth_number ?? item.toothNumber ?? null;
}

function getItemStatus(item: GenericPlanItem): string {
  return (item.status ?? 'PROPOSED').toUpperCase();
}

function getItemPrerequisiteId(item: GenericPlanItem): string | null {
  return item.depends_on_plan_item_id ?? item.dependsOnPlanItemId ?? null;
}

/**
 * Checks if a procedure's stages/execution are blocked by an incomplete prerequisite procedure.
 *
 * A prerequisite procedure is considered COMPLETED when:
 * 1. Its status in the treatment plan is 'COMPLETED', OR
 * 2. It has one or more treatment stages in the episode and ALL of them are 'COMPLETED'.
 */
export function evaluateProcedurePrerequisites(
  targetItem: GenericPlanItem,
  allPlanItems: GenericPlanItem[],
  allStages: DentalTreatmentStage[] = [],
  customRules: DentalProcedureDependencyRule[] = [],
): ProcedureDependencyEvaluationResult {
  const targetId = getItemId(targetItem);
  const targetName = getItemProcedureName(targetItem);
  const targetServiceId = getItemServiceId(targetItem);
  const targetTooth = getItemToothNumber(targetItem);

  let prerequisiteItem: GenericPlanItem | null = null;

  // 1. Check explicit depends_on_plan_item_id
  const explicitPrerequisiteId = getItemPrerequisiteId(targetItem);
  if (explicitPrerequisiteId) {
    const matched = allPlanItems.find((it) => {
      const id = getItemId(it);
      return id && id === explicitPrerequisiteId;
    });
    if (matched && getItemId(matched) !== targetId) {
      prerequisiteItem = matched;
    }
  }

  // 2. If no explicit link, check configured rules
  if (!prerequisiteItem) {
    const effectiveRules = [...globalDependencyRules, ...customRules];
    for (const rule of effectiveRules) {
      const matchesDependent =
        (rule.dependentServiceId && targetServiceId && rule.dependentServiceId === targetServiceId) ||
        (rule.dependentProcedureName && targetName && targetName.toLowerCase().includes(rule.dependentProcedureName.toLowerCase()));

      if (matchesDependent) {
        // Find matching prerequisite item on the same tooth (or general/full mouth if target has no tooth)
        const match = allPlanItems.find((it) => {
          if (getItemId(it) === targetId) return false;
          const itTooth = getItemToothNumber(it);
          if (targetTooth !== null && itTooth !== null && targetTooth !== itTooth) {
            return false;
          }
          const itName = getItemProcedureName(it);
          const itServiceId = getItemServiceId(it);
          if (rule.prerequisiteServiceId && itServiceId && rule.prerequisiteServiceId === itServiceId) {
            return true;
          }
          if (rule.prerequisiteProcedureName && itName && itName.toLowerCase().includes(rule.prerequisiteProcedureName.toLowerCase())) {
            return true;
          }
          return false;
        });

        if (match) {
          prerequisiteItem = match;
          break;
        }
      }
    }
  }

  if (!prerequisiteItem) {
    return { isBlocked: false };
  }

  const prereqId = getItemId(prerequisiteItem);
  const prereqName = getItemProcedureName(prerequisiteItem);
  const prereqStatus = getItemStatus(prerequisiteItem);

  // Check completion:
  // Is the prerequisite status explicitly COMPLETED?
  if (prereqStatus === 'COMPLETED') {
    return { isBlocked: false, prerequisiteProcedureName: prereqName, prerequisitePlanItemId: prereqId };
  }

  // Are all stages for the prerequisite item completed?
  if (prereqId) {
    const prereqStages = allStages.filter((s) => s.plan_item_id === prereqId);
    if (prereqStages.length > 0 && prereqStages.every((s) => s.status === 'COMPLETED')) {
      return { isBlocked: false, prerequisiteProcedureName: prereqName, prerequisitePlanItemId: prereqId };
    }
  }

  // Prerequisite is not completed!
  return {
    isBlocked: true,
    prerequisiteProcedureName: prereqName,
    prerequisitePlanItemId: prereqId,
    reason: `Waiting for "${prereqName}" to be completed`,
  };
}
