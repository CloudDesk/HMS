import mongoose, { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { ConsentTemplateModel, type ConsentTemplateFields } from './consent.model.js';
import type {
  ConsentFormDefinition,
  ConsentRequestMetadata,
  ConsentTemplate,
  ConsentTemplateListQuery,
  SaveConsentTemplateDTO,
} from './consent.types.js';

type RecordType = ConsentTemplateFields & { _id: Types.ObjectId };
const oid = (value: string) => new Types.ObjectId(value);

const toDto = (item: RecordType): ConsentTemplate => ({
  id: item._id.toString(),
  branch_id: item.branchId.toString(),
  code: item.code,
  name: item.name,
  category: item.category,
  context_type: item.contextType,
  mandatory: item.mandatory,
  version: item.version,
  status: item.status,
  form_definition: item.formDefinition ?? null,
  published_at: item.publishedAt ?? null,
  published_by: item.publishedBy?.toString() ?? null,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});

export class ConsentRepository {
  async session(): Promise<ClientSession> {
    return mongoose.startSession();
  }

  async hasBranchAccess(userId: string, branchId: string) {
    const [user, branch] = await Promise.all([
      UserModel.findOne({ _id: userId, status: 'active', deletedAt: null }).select('branchIds roleIds').lean(),
      BranchModel.exists({ _id: branchId, status: 'ACTIVE', deletedAt: null }),
    ]);
    if (!user || !branch) return false;
    if ((user.branchIds ?? []).some((id) => id.toString() === branchId)) return true;
    return Boolean(await RoleModel.exists({ _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null }));
  }

  async list(query: ConsentTemplateListQuery) {
    const filter: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.context_type) filter.contextType = query.context_type;
    if (query.status) filter.status = query.status;
    const records = await ConsentTemplateModel.find(filter)
      .sort({ category: 1, code: 1, version: -1 })
      .lean<RecordType[]>();
    return records.map(toDto);
  }

  async get(id: string, branchId: string) {
    const record = await ConsentTemplateModel.findOne({ _id: oid(id), branchId: oid(branchId) }).lean<RecordType>();
    return record ? toDto(record) : null;
  }

  async getById(id: string) {
    const record = await ConsentTemplateModel.findById(oid(id)).lean<RecordType>();
    return record ? toDto(record) : null;
  }

  async create(data: SaveConsentTemplateDTO, actor: string) {
    const record = await ConsentTemplateModel.create({
      branchId: oid(data.branch_id),
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      category: data.category.trim(),
      contextType: data.context_type,
      mandatory: data.mandatory,
      version: 1,
      status: data.status ?? 'DRAFT',
      formDefinition: data.form_definition ?? null,
      createdBy: oid(actor),
      updatedBy: oid(actor),
    });
    return toDto(record.toObject() as RecordType);
  }

  async update(id: string, data: SaveConsentTemplateDTO, actor: string) {
    const existing = await ConsentTemplateModel.findOne({ _id: oid(id), branchId: oid(data.branch_id) }).lean<RecordType>();
    if (!existing) return null;

    const record = await ConsentTemplateModel.findOneAndUpdate(
      { _id: oid(id), branchId: oid(data.branch_id) },
      {
        $set: {
          code: data.code.trim().toUpperCase(),
          name: data.name.trim(),
          category: data.category.trim(),
          contextType: data.context_type,
          mandatory: data.mandatory,
          status: data.status ?? existing.status,
          ...(data.form_definition !== undefined ? { formDefinition: data.form_definition } : {}),
          updatedBy: oid(actor),
        },
      },
      { returnDocument: 'after', runValidators: true, lean: true },
    ).lean<RecordType>();

    return record ? toDto(record) : null;
  }

  async saveFormDefinition(id: string, branchId: string, formDefinition: ConsentFormDefinition, actor: string) {
    const record = await ConsentTemplateModel.findOneAndUpdate(
      { _id: oid(id), branchId: oid(branchId) },
      { $set: { formDefinition, updatedBy: oid(actor) } },
      { returnDocument: 'after', runValidators: true, lean: true },
    ).lean<RecordType>();
    return record ? toDto(record) : null;
  }

  async publish(id: string, branchId: string, actor: string, session?: ClientSession) {
    if (!session || !session.inTransaction()) {
      throw new AppError(
        'Consent publishing requires multi-document transaction guarantees, which are unavailable on this database topology',
        503,
        'TRANSACTION_UNAVAILABLE',
      );
    }

    const existingQuery = ConsentTemplateModel.findOne({ _id: oid(id), branchId: oid(branchId) });
    existingQuery.session(session);
    const existing = await existingQuery.lean<RecordType>();
    if (!existing) return null;

    if (existing.status === 'INACTIVE') {
      throw new AppError('Archived consent templates cannot be published', 400, 'CANNOT_PUBLISH_INACTIVE_TEMPLATE');
    }

    // Step 1: Retire any previously active template with the same code in this branch
    await ConsentTemplateModel.updateMany(
      { branchId: oid(branchId), code: existing.code, _id: { $ne: existing._id }, status: 'ACTIVE' },
      { $set: { status: 'INACTIVE', updatedBy: oid(actor) } },
      { session },
    );

    // Step 2: Activate this version
    const published = await ConsentTemplateModel.findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          status: 'ACTIVE',
          publishedAt: new Date(),
          publishedBy: oid(actor),
          updatedBy: oid(actor),
        },
      },
      { returnDocument: 'after', lean: true, session },
    ).lean<RecordType>();

    return published ? toDto(published) : null;
  }

  async detectDuplicateActiveScopes(session?: ClientSession): Promise<Array<{
    branchId: string;
    code: string;
    count: number;
    templates: Array<{
      id: string;
      version: number;
      name: string;
      publishedAt: Date | null;
      updatedAt: Date;
    }>;
  }>> {
    const aggregation = ConsentTemplateModel.aggregate([
      { $match: { status: 'ACTIVE' } },
      {
        $group: {
          _id: { branchId: '$branchId', code: '$code' },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);
    if (session) aggregation.session(session);
    const duplicates = await aggregation;

    const results: Array<{
      branchId: string;
      code: string;
      count: number;
      templates: Array<{
        id: string;
        version: number;
        name: string;
        publishedAt: Date | null;
        updatedAt: Date;
      }>;
    }> = [];

    for (const group of duplicates) {
      const docsQuery = ConsentTemplateModel.find({ _id: { $in: group.ids } }).sort({ version: 1 });
      if (session) docsQuery.session(session);
      const docs = await docsQuery.lean<RecordType[]>();

      results.push({
        branchId: group._id.branchId.toString(),
        code: group._id.code,
        count: group.count,
        templates: docs.map((d) => ({
          id: d._id.toString(),
          version: d.version,
          name: d.name,
          publishedAt: d.publishedAt ?? null,
          updatedAt: d.updatedAt,
        })),
      });
    }

    return results;
  }

  async resolveDuplicateActiveScopesWithApprovedSelection(
    approvedSelections: Record<string, string>,
    actor: string,
    session?: ClientSession,
  ) {
    const duplicateScopes = await this.detectDuplicateActiveScopes(session);
    const resolved: Array<{ branchId: string; code: string; approvedId: string; retiredIds: string[] }> = [];

    for (const group of duplicateScopes) {
      const scopeKey = `${group.branchId}:${group.code}`;
      const approvedId = approvedSelections[scopeKey] || approvedSelections[group.code];
      if (!approvedId) {
        throw new AppError(
          `Ambiguous active consent versions found for scope ${scopeKey}. An approved selection decision is required.`,
          400,
          'AMBIGUOUS_CONSENT_SELECTION_REQUIRED',
          { scope: group },
        );
      }

      const validIds = group.templates.map((t) => t.id);
      if (!validIds.includes(approvedId)) {
        throw new AppError(
          `Selected template ${approvedId} is not an active version in scope ${scopeKey}`,
          400,
          'INVALID_APPROVED_SELECTION',
          { validIds, provided: approvedId },
        );
      }

      const toDeactivate = validIds.filter((id) => id !== approvedId).map(oid);
      await ConsentTemplateModel.updateMany(
        { _id: { $in: toDeactivate } },
        { $set: { status: 'INACTIVE', updatedBy: oid(actor) } },
        { session: session ?? undefined },
      );

      resolved.push({
        branchId: group.branchId,
        code: group.code,
        approvedId,
        retiredIds: toDeactivate.map((id) => id.toString()),
      });
    }

    return resolved;
  }

  async ensureActiveUniquenessIndex() {
    const duplicates = await this.detectDuplicateActiveScopes();
    if (duplicates.length > 0) {
      throw new AppError(
        `Cannot build active consent uniqueness index: ${duplicates.length} duplicate active scope(s) detected. An approved selection decision is required before index creation.`,
        409,
        'DUPLICATE_ACTIVE_CONSENTS_REQUIRE_APPROVAL',
        { duplicates },
      );
    }
    await ConsentTemplateModel.createIndexes();
  }

  async createNextVersion(id: string, branchId: string, actor: string) {
    const existing = await ConsentTemplateModel.findOne({ _id: oid(id), branchId: oid(branchId) }).lean<RecordType>();
    if (!existing) return null;

    const highestVersionRecord = await ConsentTemplateModel.findOne({ branchId: oid(branchId), code: existing.code })
      .sort({ version: -1 })
      .lean<RecordType>();

    const nextVersion = (highestVersionRecord?.version ?? existing.version) + 1;

    const created = await ConsentTemplateModel.create({
      branchId: existing.branchId,
      code: existing.code,
      name: existing.name,
      category: existing.category,
      contextType: existing.contextType,
      mandatory: existing.mandatory,
      version: nextVersion,
      status: 'DRAFT',
      formDefinition: existing.formDefinition ?? null,
      publishedAt: null,
      publishedBy: null,
      createdBy: oid(actor),
      updatedBy: oid(actor),
    });

    return toDto(created.toObject() as RecordType);
  }

  async audit(
    eventType: string,
    actor: string,
    metadata: ConsentRequestMetadata | undefined,
    details: Record<string, unknown>,
    session?: ClientSession,
  ) {
    const record = new AuditLogModel({
      eventType,
      actorUserId: actor,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      metadataJson: details,
    });
    await record.save({ session: session ?? undefined });
  }

  isDuplicate(error: unknown) {
    return error instanceof Error && 'code' in error && error.code === 11000;
  }

  isConflict(error: unknown) {
    if (this.isDuplicate(error)) return true;
    if (error instanceof Error && error.message.toLowerCase().includes('write conflict')) return true;
    return false;
  }
}
