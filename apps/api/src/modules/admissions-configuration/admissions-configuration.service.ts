import { createHash, randomUUID } from 'node:crypto';
import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { BedFields } from './admissions-configuration.model.js';
import {
  toTransfer,
  type AdmissionRecord,
  type AdmissionsConfigurationRepository,
} from './admissions-configuration.repository.js';
import type {
  BedListQuery,
  CancelBedTransferDTO,
  CloseBedHoldDTO,
  CompleteBedTransferDTO,
  CreateBedDTO,
  CreateBedHoldDTO,
  CreateBedTransferDTO,
  CreateWardDTO,
  SaveAdmissionPolicyDTO,
  StatusActionMetadata,
  UpdateBedDTO,
  UpdateWardDTO,
  WardListQuery,
} from './admissions-configuration.types.js';

const holdHash = (bedId: string, data: CreateBedHoldDTO) => createHash('sha256').update(JSON.stringify({ bedId, branchId: data.branch_id, patientId: data.patient_id, admissionId: data.admission_id ?? null, reason: data.reason.trim() })).digest('hex');
const holdNumber = () => `HLD-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

export class AdmissionsConfigurationService {
  constructor(private readonly repository: AdmissionsConfigurationRepository) {}

  private async authorize(userId: string, branchId: string) {
    if (!await this.repository.hasBranchAccess(userId, branchId)) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
  }

  private duplicate(error: unknown): never {
    if (this.repository.duplicateError(error)) throw new AppError('The requested bed lifecycle record conflicts with an existing active record', 409, 'BED_LIFECYCLE_CONFLICT');
    throw error;
  }

  private async expireHolds(branchId: string, actor: string, metadata: StatusActionMetadata) {
    const expired = await this.repository.findExpiredHolds(branchId, new Date());
    for (const item of expired) {
      const session = await this.repository.session();
      try {
        await session.withTransaction(async () => {
          const hold = await this.repository.closeHold(item._id.toString(), branchId, 'EXPIRED', 'Hold duration elapsed', actor, session);
          if (hold) await this.repository.audit('admissions.bed_hold.expired', actor, metadata, { holdId: hold.id, bedId: hold.bed_id, branchId }, session);
        });
      } finally {
        await session.endSession();
      }
    }
  }

  async listWards(query: WardListQuery, actor: string) { await this.authorize(actor, query.branch_id); return this.repository.listWards(query); }
  async getWard(id: string, branchId: string, actor: string) { await this.authorize(actor, branchId); const item = await this.repository.getWard(id, branchId); if (!item) throw new AppError('Ward not found', 404, 'WARD_NOT_FOUND'); return item; }
  async createWard(data: CreateWardDTO, actor: string, metadata: StatusActionMetadata) { await this.authorize(actor, data.branch_id); try { const ward = await this.repository.createWard(data, actor); await this.repository.audit('admissions.ward.created', actor, metadata, { wardId: ward.id, branchId: data.branch_id }); return ward; } catch (error) { return this.duplicate(error); } }
  async updateWard(id: string, data: UpdateWardDTO, actor: string, metadata: StatusActionMetadata) { await this.authorize(actor, data.branch_id); try { const ward = await this.repository.updateWard(id, data, actor); if (!ward) throw new AppError('Ward not found or contains active bed ownership', 409, 'WARD_UPDATE_CONFLICT'); await this.repository.audit('admissions.ward.updated', actor, metadata, { wardId: id, branchId: data.branch_id }); return ward; } catch (error) { return this.duplicate(error); } }
  async updateWardStatus(id: string, branchId: string, status: 'ACTIVE' | 'INACTIVE', actor: string, metadata: StatusActionMetadata) { await this.authorize(actor, branchId); if (status === 'INACTIVE' && await this.repository.countProtectedBedsInWard(id, branchId) > 0) throw new AppError('A ward with reserved or occupied beds cannot be deactivated', 409, 'WARD_HAS_ACTIVE_BEDS'); const ward = await this.repository.updateWardStatus(id, branchId, status, actor); if (!ward) throw new AppError('Ward not found', 404, 'WARD_NOT_FOUND'); await this.repository.audit('admissions.ward.status_changed', actor, metadata, { wardId: id, branchId, status }); return ward; }

  async listBeds(query: BedListQuery, actor: string, metadata: StatusActionMetadata = {}) { await this.authorize(actor, query.branch_id); await this.expireHolds(query.branch_id, actor, metadata); return this.repository.listBeds(query); }
  async getBed(id: string, branchId: string, actor: string, metadata: StatusActionMetadata = {}) { await this.authorize(actor, branchId); await this.expireHolds(branchId, actor, metadata); const item = await this.repository.getBed(id, branchId); if (!item) throw new AppError('Bed not found', 404, 'BED_NOT_FOUND'); return item; }
  async createBed(data: CreateBedDTO, actor: string, metadata: StatusActionMetadata) { await this.authorize(actor, data.branch_id); const ward = await this.repository.getWard(data.ward_id, data.branch_id); if (!ward) throw new AppError('Ward not found in selected branch', 404, 'WARD_NOT_FOUND'); if (ward.status !== 'ACTIVE') throw new AppError('Beds cannot be added to an inactive ward', 409, 'WARD_INACTIVE'); try { const bed = await this.repository.createBed(data, actor); if (!bed) throw new AppError('Bed could not be created', 500, 'BED_CREATE_FAILED'); await this.repository.audit('admissions.bed.created', actor, metadata, { bedId: bed.id, wardId: data.ward_id, branchId: data.branch_id }); return bed; } catch (error) { return this.duplicate(error); } }
  async updateBed(id: string, data: UpdateBedDTO & { branch_id: string }, actor: string, metadata: StatusActionMetadata) { await this.authorize(actor, data.branch_id); try { const bed = await this.repository.updateBed(id, data.branch_id, data, actor); if (!bed) throw new AppError('Bed is not editable while held or occupied', 409, 'BED_OWNERSHIP_CONFLICT'); await this.repository.audit('admissions.bed.updated', actor, metadata, { bedId: id, branchId: data.branch_id }); return bed; } catch (error) { return this.duplicate(error); } }
  async updateBedStatus(id: string, branchId: string, status: BedFields['status'], reason: string | null, actor: string, metadata: StatusActionMetadata) { await this.authorize(actor, branchId); if (status === 'OCCUPIED' || status === 'RESERVED') throw new AppError('Occupied and reserved states are managed only by allotment and hold workflows', 409, 'MANUAL_BED_OWNERSHIP_FORBIDDEN'); if ((status === 'BLOCKED' || status === 'UNDER_MAINTENANCE') && !reason?.trim()) throw new AppError('A reason is required to block a bed or place it under maintenance', 400, 'BED_STATUS_REASON_REQUIRED'); const bed = await this.repository.updateBedStatus(id, branchId, status, reason?.trim() ?? null, actor); if (!bed) throw new AppError('Bed is held, occupied, stale, or not found', 409, 'BED_OWNERSHIP_CONFLICT'); await this.repository.audit('admissions.bed.status_changed', actor, metadata, { bedId: id, branchId, status, reason: reason?.trim() ?? null }); return bed; }
  async summary(branchId: string, actor: string, metadata: StatusActionMetadata = {}) { await this.authorize(actor, branchId); await this.expireHolds(branchId, actor, metadata); return this.repository.summary(branchId); }

  async getPolicy(branchId: string, actor: string) { await this.authorize(actor, branchId); const policy = await this.repository.getPolicy(branchId); if (!policy) throw new AppError('Configure an active admission policy for this branch', 409, 'ADMISSION_POLICY_NOT_CONFIGURED'); return policy; }
  async getPolicyForConfirmation(branchId: string, session: ClientSession) { const policy = await this.repository.getPolicy(branchId, session); if (!policy) throw new AppError('Configure an active admission policy for this branch', 409, 'ADMISSION_POLICY_NOT_CONFIGURED'); return policy; }
  async savePolicy(data: SaveAdmissionPolicyDTO, actor: string, metadata: StatusActionMetadata) { await this.authorize(actor, data.branch_id); const session = await this.repository.session(); try { let result; await session.withTransaction(async () => { result = await this.repository.savePolicy(data, actor, session); await this.repository.audit('admissions.policy.updated', actor, metadata, { branchId: data.branch_id, bedHoldDurationMinutes: data.bed_hold_duration_minutes }, session); }); if (!result) throw new AppError('Admission policy could not be saved', 500, 'ADMISSION_POLICY_SAVE_FAILED'); return result; } finally { await session.endSession(); } }

  async createHold(bedId: string, data: CreateBedHoldDTO, actor: string, metadata: StatusActionMetadata) {
    await this.authorize(actor, data.branch_id); await this.expireHolds(data.branch_id, actor, metadata);
    const requestHash = holdHash(bedId, data); const replay = await this.repository.getHoldByIdempotencyKey(data.idempotency_key);
    if (replay) { if (replay.requestHash !== requestHash) throw new AppError('The idempotency key was already used for a different hold request', 409, 'IDEMPOTENCY_CONFLICT'); return replay.hold; }
    const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        const policy = await this.repository.getPolicy(data.branch_id, session); if (!policy) throw new AppError('Configure an active admission policy for this branch', 409, 'ADMISSION_POLICY_NOT_CONFIGURED');
        if (!await this.repository.patientExists(data.patient_id, session)) throw new AppError('Active patient not found', 404, 'PATIENT_NOT_FOUND');
        const bed = await this.repository.getBedRecord(bedId, data.branch_id, session); if (!bed) throw new AppError('Bed not found', 404, 'BED_NOT_FOUND');
        const ward = await this.repository.getWard(bed.wardId.toString(), data.branch_id, session); if (!ward || ward.status !== 'ACTIVE') throw new AppError('Bed ward is not active', 409, 'WARD_INACTIVE');
        const holdId = new Types.ObjectId(); const reserved = await this.repository.reserveBedForHold(bedId, data.branch_id, holdId, actor, session); if (!reserved) throw new AppError('Bed is no longer available; refresh the bed board', 409, 'BED_NOT_AVAILABLE');
        const expiresAt = new Date(Date.now() + policy.bed_hold_duration_minutes * 60_000);
        result = await this.repository.createHold(holdId, holdNumber(), requestHash, bed, ward, data, actor, expiresAt, session);
        await this.repository.audit('admissions.bed_hold.created', actor, metadata, { holdId: result.id, bedId, patientId: data.patient_id, branchId: data.branch_id, expiresAt }, session);
      });
      if (!result) throw new AppError('Bed hold could not be created', 500, 'BED_HOLD_CREATE_FAILED'); return result;
    } catch (error) { return this.duplicate(error); } finally { await session.endSession(); }
  }

  async closeHold(id: string, data: CloseBedHoldDTO, action: 'RELEASED' | 'CANCELLED', actor: string, metadata: StatusActionMetadata) { await this.authorize(actor, data.branch_id); const session = await this.repository.session(); try { let result; await session.withTransaction(async () => { result = await this.repository.closeHold(id, data.branch_id, action, data.reason.trim(), actor, session); if (!result) throw new AppError('Active bed hold not found or bed ownership changed', 409, 'BED_HOLD_CONFLICT'); await this.repository.audit(action === 'RELEASED' ? 'admissions.bed_hold.released' : 'admissions.bed_hold.cancelled', actor, metadata, { holdId: id, bedId: result.bed_id, branchId: data.branch_id, reason: data.reason.trim() }, session); }); return result; } finally { await session.endSession(); } }

  async allotAdmission(admission: AdmissionRecord, bedId: string, branchId: string, holdId: string | null, actor: string, metadata: StatusActionMetadata, session: ClientSession) {
    const policy = await this.repository.getPolicy(branchId, session); if (!policy) throw new AppError('Configure an active admission policy for this branch', 409, 'ADMISSION_POLICY_NOT_CONFIGURED');
    const bedBefore = await this.repository.getBedRecord(bedId, branchId, session); if (!bedBefore) throw new AppError('Bed not found', 404, 'BED_NOT_FOUND');
    const ward = await this.repository.getWard(bedBefore.wardId.toString(), branchId, session); if (!ward || ward.status !== 'ACTIVE') throw new AppError('Active ward not found', 409, 'WARD_INACTIVE');
    const allotted = await this.repository.allotBed(admission, bedId, branchId, holdId, actor, session); if (!allotted) throw new AppError('Bed is no longer available or the hold is invalid', 409, 'BED_NOT_AVAILABLE');
    await this.repository.recordAssignment(admission, allotted, ward, 'ALLOTTED', holdId ? 'Admission confirmed from active hold' : 'Admission confirmed by direct allotment', actor, null, session);
    await this.repository.audit('admissions.bed.allotted', actor, metadata, { admissionId: admission._id.toString(), patientId: admission.patientId.toString(), branchId, wardId: allotted.wardId.toString(), bedId }, session);
  }

  async cancelAdmissionRequestHold(holdId: string, branchId: string, reason: string, actor: string, metadata: StatusActionMetadata, session: ClientSession) {
    const hold = await this.repository.closeHold(holdId, branchId, 'CANCELLED', reason, actor, session);
    if (!hold) throw new AppError('Active bed hold not found or bed ownership changed', 409, 'BED_HOLD_CONFLICT');
    await this.repository.audit('admissions.bed_hold.cancelled', actor, metadata, { holdId, bedId: hold.bed_id, branchId, reason }, session);
    return hold;
  }

  async releaseAdmissionBed(admission: AdmissionRecord, preparationRequired: boolean, reason: string, actor: string, metadata: StatusActionMetadata, session: ClientSession) {
    const bed = await this.repository.getBedRecord(admission.bedId.toString(), admission.branchId.toString(), session);
    if (!bed || bed.currentAdmissionId?.toString() !== admission._id.toString() || bed.status !== 'OCCUPIED') throw new AppError('Admission no longer owns the selected bed', 409, 'BED_OWNERSHIP_CONFLICT');
    const ward = await this.repository.getWard(bed.wardId.toString(), admission.branchId.toString(), session);
    if (!ward) throw new AppError('Admission ward not found', 404, 'WARD_NOT_FOUND');
    const released = await this.repository.releaseAdmissionBed(admission, preparationRequired, actor, session);
    if (!released) throw new AppError('Bed ownership changed before release', 409, 'BED_OWNERSHIP_CONFLICT');
    await this.repository.recordAssignment(admission, bed, ward, 'RELEASED', reason, actor, null, session);
    await this.repository.audit('admissions.bed.released', actor, metadata, { admissionId: admission._id.toString(), patientId: admission.patientId.toString(), branchId: admission.branchId.toString(), bedId: bed._id.toString(), targetStatus: preparationRequired ? 'BLOCKED' : 'AVAILABLE', blockReasonCode: preparationRequired ? 'CLEANING' : null, reason }, session);
  }

  async createTransfer(admissionId: string, data: CreateBedTransferDTO, actor: string, metadata: StatusActionMetadata, allowCrossBranch: boolean) {
    await this.authorize(actor, data.branch_id); await this.authorize(actor, data.destination_branch_id);
    const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        const admission = await this.repository.getAdmission(admissionId, data.branch_id, session); if (!admission || admission.status !== 'ADMITTED') throw new AppError('Active admission not found', 404, 'ADMISSION_NOT_FOUND');
        if (data.destination_branch_id !== data.branch_id && !allowCrossBranch) throw new AppError('Cross-branch transfer permission is required', 403, 'CROSS_BRANCH_TRANSFER_PERMISSION_REQUIRED');
        if (await this.repository.getPendingTransferForAdmission(admissionId, session)) throw new AppError('This admission already has a pending transfer', 409, 'TRANSFER_ALREADY_PENDING');
        const sourceBed = await this.repository.getBedRecord(admission.bedId.toString(), data.branch_id, session); if (!sourceBed || sourceBed.currentAdmissionId?.toString() !== admissionId || sourceBed.status !== 'OCCUPIED') throw new AppError('Current admission bed ownership is inconsistent', 409, 'SOURCE_BED_OWNERSHIP_CONFLICT');
        const sourceWard = await this.repository.getWard(sourceBed.wardId.toString(), data.branch_id, session); const destinationBed = await this.repository.getBedRecord(data.destination_bed_id, data.destination_branch_id, session); const destinationWard = await this.repository.getWard(data.destination_ward_id, data.destination_branch_id, session);
        if (!sourceWard) throw new AppError('Source ward not found', 404, 'WARD_NOT_FOUND'); if (!destinationBed || destinationBed.wardId.toString() !== data.destination_ward_id || destinationBed.status !== 'AVAILABLE' || destinationBed.currentAdmissionId || destinationBed.currentHoldId) throw new AppError('Destination bed is not available', 409, 'DESTINATION_BED_NOT_AVAILABLE'); if (!destinationWard || destinationWard.status !== 'ACTIVE') throw new AppError('Destination ward is not active', 409, 'WARD_INACTIVE'); if (destinationBed._id.toString() === sourceBed._id.toString()) throw new AppError('Destination bed must differ from the current bed', 400, 'SAME_BED_TRANSFER');
        result = await this.repository.createTransfer(admission, sourceBed, sourceWard, destinationBed, destinationWard, data, actor, session);
        await this.repository.audit('admissions.bed_transfer.requested', actor, metadata, { transferId: result.id, admissionId, sourceBedId: sourceBed._id.toString(), destinationBedId: destinationBed._id.toString(), crossBranch: data.destination_branch_id !== data.branch_id }, session);
      });
      if (!result) throw new AppError('Bed transfer could not be created', 500, 'TRANSFER_CREATE_FAILED'); return result;
    } catch (error) { return this.duplicate(error); } finally { await session.endSession(); }
  }

  async completeTransfer(id: string, data: CompleteBedTransferDTO, actor: string, metadata: StatusActionMetadata, allowCrossBranch: boolean) {
    await this.authorize(actor, data.branch_id); const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        const transfer = await this.repository.getTransfer(id, data.branch_id, session); if (!transfer || transfer.status !== 'PENDING') throw new AppError('Pending bed transfer not found', 404, 'TRANSFER_NOT_FOUND');
        if (transfer.destinationBranchId.toString() !== data.branch_id) await this.authorize(actor, transfer.destinationBranchId.toString());
        if (transfer.destinationBranchId.toString() !== transfer.sourceBranchId.toString() && !allowCrossBranch) throw new AppError('Cross-branch transfer permission is required', 403, 'CROSS_BRANCH_TRANSFER_PERMISSION_REQUIRED');
        const admission = await this.repository.getAdmission(transfer.admissionId.toString(), transfer.sourceBranchId.toString(), session); if (!admission || admission.status !== 'ADMITTED') throw new AppError('Active admission not found', 409, 'ADMISSION_NOT_ACTIVE');
        const sourceBed = await this.repository.getBedRecord(transfer.sourceBedId.toString(), transfer.sourceBranchId.toString(), session); const destinationBedBefore = await this.repository.getBedRecord(transfer.destinationBedId.toString(), transfer.destinationBranchId.toString(), session); const sourceWard = await this.repository.getWard(transfer.sourceWardId.toString(), transfer.sourceBranchId.toString(), session); const destinationWard = await this.repository.getWard(transfer.destinationWardId.toString(), transfer.destinationBranchId.toString(), session);
        if (!sourceBed || !sourceWard || !destinationBedBefore || !destinationWard) throw new AppError('Transfer bed context is no longer valid', 409, 'TRANSFER_CONTEXT_INVALID');
        const releasedSource = await this.repository.releaseTransferSource(transfer, actor, session); if (!releasedSource) throw new AppError('Source bed ownership changed', 409, 'SOURCE_BED_OWNERSHIP_CONFLICT');
        const destinationBed = await this.repository.claimTransferDestination(transfer, actor, session); if (!destinationBed) throw new AppError('Destination bed is no longer available', 409, 'DESTINATION_BED_NOT_AVAILABLE');
        const updatedAdmission = await this.repository.updateAdmissionForTransfer(transfer, actor, session); if (!updatedAdmission) throw new AppError('Admission changed before transfer completion', 409, 'ADMISSION_CONFLICT');
        await this.repository.recordAssignment(admission, sourceBed, sourceWard, 'TRANSFERRED_OUT', transfer.reason, actor, transfer._id, session); await this.repository.recordAssignment(updatedAdmission, destinationBed, destinationWard, 'TRANSFERRED_IN', transfer.reason, actor, transfer._id, session);
        const completed = await this.repository.completeTransfer(id, actor, session); if (!completed) throw new AppError('Transfer changed before completion', 409, 'TRANSFER_CONFLICT'); result = toTransfer(completed);
        await this.repository.audit('admissions.bed_transfer.completed', actor, metadata, { transferId: id, admissionId: transfer.admissionId.toString(), sourceBedId: transfer.sourceBedId.toString(), destinationBedId: transfer.destinationBedId.toString() }, session);
      });
      if (!result) throw new AppError('Bed transfer could not be completed', 500, 'TRANSFER_COMPLETE_FAILED'); return result;
    } finally { await session.endSession(); }
  }

  async cancelTransfer(id: string, data: CancelBedTransferDTO, actor: string, metadata: StatusActionMetadata) { await this.authorize(actor, data.branch_id); const session = await this.repository.session(); try { let result; await session.withTransaction(async () => { result = await this.repository.cancelTransfer(id, data.branch_id, data.reason.trim(), actor, session); if (!result) throw new AppError('Pending bed transfer not found', 404, 'TRANSFER_NOT_FOUND'); await this.repository.audit('admissions.bed_transfer.cancelled', actor, metadata, { transferId: id, admissionId: result.admission_id, reason: data.reason.trim() }, session); }); return result; } finally { await session.endSession(); } }
}
