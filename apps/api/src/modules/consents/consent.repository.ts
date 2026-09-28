import { Types } from 'mongoose';
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

  async publish(id: string, branchId: string, actor: string) {
    const existing = await ConsentTemplateModel.findOne({ _id: oid(id), branchId: oid(branchId) }).lean<RecordType>();
    if (!existing) return null;

    // Retire any previously active template with the same code in this branch
    await ConsentTemplateModel.updateMany(
      { branchId: oid(branchId), code: existing.code, _id: { $ne: existing._id }, status: 'ACTIVE' },
      { $set: { status: 'INACTIVE', updatedBy: oid(actor) } },
    );

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
      { returnDocument: 'after', lean: true },
    ).lean<RecordType>();

    return published ? toDto(published) : null;
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

  async audit(eventType: string, actor: string, metadata: ConsentRequestMetadata | undefined, details: Record<string, unknown>) {
    await AuditLogModel.create({
      eventType,
      actorUserId: actor,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      metadataJson: details,
    });
  }

  isDuplicate(error: unknown) {
    return error instanceof Error && 'code' in error && error.code === 11000;
  }
}
