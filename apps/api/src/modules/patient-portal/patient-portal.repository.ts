import mongoose, { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { AppointmentModel } from '../appointments/appointment.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { BillingInvoiceItemModel, BillingInvoiceModel, BillingPaymentModel } from '../billing/billing.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { ImagingReportModel } from '../imaging/imaging-report.model.js';
import { LaboratoryResultModel } from '../laboratory/laboratory-result.model.js';
import { OpdPrescriptionModel } from '../opd/opd-prescription.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { PatientModel, PatientTimelineEventModel } from '../patients/patient.model.js';
import { allocatePatientNumber } from '../patients/patient-number.service.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { RefreshTokenModel } from '../auth/refresh-token.model.js';
import { RoleModel } from '../roles/role.model.js';
import { ServiceModel } from '../services/service.model.js';
import { UserModel } from '../users/user.model.js';
import { PatientAccessGrantModel, type PatientAccessRelationship } from './patient-access-grant.model.js';
import { GuardianProfileModel, type GuardianRelationship } from './guardian-profile.model.js';
import { buildPhoneMongoFilter } from '../../utils/phone.js';

const objectId = (value?: string | null) => (value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined);
const validObjectIds = (values: unknown[]) =>
  [...new Set(values.map((v) => (v ? String(v) : null)).filter((v): v is string => Boolean(v && Types.ObjectId.isValid(v))))].map(
    (v) => new Types.ObjectId(v),
  );
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

type PortalAppointmentHistoryItem = {
  id: string;
  appointment_number: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization: string;
  branch_id: string;
  branch_name: string;
  department_id: string;
  department_name: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
  visit_type: string;
  status: string;
  reason: string | null;
  rescheduled_from_id: string | null;
  rescheduled_to_id: string | null;
  is_opd_visit: boolean;
  opd_visit_number: string | null;
};

type PortalAppointmentHistoryAggregation = {
  data: PortalAppointmentHistoryItem[];
  metadata: Array<{ total: number }>;
};

export class PatientPortalRepository {
  session() {
    return mongoose.startSession();
  }

  async listPublicBranches(query: { page: number; limit: number; search?: string }) {
    const filter: Record<string, unknown> = {
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };
    if (query.search) {
      const expression = new RegExp(escapeRegex(query.search), 'i');
      filter.$and = [
        { $or: [{ name: expression }, { city: expression }, { address: expression }] },
      ];
    }
    const [branches, total] = await Promise.all([
      BranchModel.find(filter)
        .select('code name shortName email phone address city state country postalCode')
        .sort({ name: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      BranchModel.countDocuments(filter),
    ]);
    return {
      data: branches.map((branch) => ({
        id: String(branch._id),
        code: branch.code,
        name: branch.name,
        short_name: branch.shortName ?? null,
        email: branch.email ?? null,
        phone: branch.phone ?? null,
        address: branch.address ?? null,
        city: branch.city ?? null,
        state: branch.state ?? null,
        country: branch.country ?? null,
        postal_code: branch.postalCode ?? null,
      })),
      meta: pageMeta(query.page, query.limit, total),
    };
  }

  async activeBranchExists(branchId: string) {
    const validId = objectId(branchId);
    if (!validId) return false;
    return Boolean(await BranchModel.exists({
      _id: validId,
      deletedAt: null,
      $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }, { status: null }],
    }));
  }

  async listPublicDepartments(query: { page: number; limit: number; search?: string; branchId?: string }) {
    const nonClinicalRegex = /administration|admin|billing|finance|reception|nursing|pharmacy|imaging|laboratory|lab/i;
    const baseFilter: Record<string, unknown> = {
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      status: { $ne: 'INACTIVE' },
      isClinical: { $ne: false },
      name: { $not: nonClinicalRegex },
      code: { $not: nonClinicalRegex },
    };
    const andConditions: Record<string, unknown>[] = [baseFilter];
    if (query.branchId) {
      const bId = query.branchId;
      const validObjId = objectId(bId);
      const branchConds: Record<string, unknown>[] = [{ branchId: String(bId) }];
      if (validObjId) branchConds.push({ branchId: validObjId });
      andConditions.push({ $or: branchConds });
    }
    if (query.search) {
      andConditions.push({ name: new RegExp(escapeRegex(query.search), 'i') });
    }
    const filter = andConditions.length > 1 ? { $and: andConditions } : baseFilter;
    const departments = await DepartmentModel.find(filter)
      .select('code name description branchId')
      .sort({ name: 1 })
      .lean();

    const seenNames = new Set<string>();
    const uniqueDepartments = departments.filter((dept) => {
      const key = dept.name.trim().toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });

    const total = uniqueDepartments.length;
    const pagedDepartments = uniqueDepartments.slice((query.page - 1) * query.limit, query.page * query.limit);

    const branchIds = validObjectIds(pagedDepartments.map((item) => (item as any).branchId ?? (item as any).branchIds?.[0]));
    const branches = branchIds.length
      ? await BranchModel.find({ _id: { $in: branchIds }, deletedAt: null }).select('name city').lean()
      : [];
    const branchById = new Map(branches.map((branch) => [String(branch._id), branch]));
    return {
      data: pagedDepartments.map((department) => {
        const deptBranchId = (department as any).branchId ?? (department as any).branchIds?.[0];
        const branch = branchById.get(String(deptBranchId));
        return {
          id: String(department._id),
          code: department.code,
          name: department.name,
          description: department.description ?? null,
          branch: { id: String(deptBranchId), name: branch?.name ?? 'Hospital Branch', city: branch?.city ?? null },
        };
      }),
      meta: pageMeta(query.page, query.limit, total),
    };
  }

  async listPublicServices(query: { page: number; limit: number; search?: string; departmentId?: string; branchId?: string }) {
    const filter: Record<string, unknown> = {
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };
    if (query.departmentId) {
      const validObjId = objectId(query.departmentId);
      const targetDept = validObjId ? await DepartmentModel.findById(validObjId).lean() : null;
      if (targetDept) {
        const sameNameDepts = await DepartmentModel.find({ name: targetDept.name, deletedAt: null, status: { $ne: 'INACTIVE' } }).select('_id').lean();
        filter.departmentId = { $in: sameNameDepts.map((d) => d._id) };
      } else {
        filter.departmentId = objectId(query.departmentId);
      }
    }
    if (query.branchId) {
      const departmentIds = await DepartmentModel.distinct('_id', {
        branchIds: objectId(query.branchId),
        deletedAt: null,
      });
      filter.departmentId = query.departmentId
        ? { $in: departmentIds.filter((id) => String(id) === query.departmentId) }
        : { $in: departmentIds };
    }
    if (query.search) {
      const expression = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: expression }, { category: expression }, { description: expression }];
    }
    const [services, total] = await Promise.all([
      ServiceModel.find(filter)
        .select('code name serviceType category description departmentId standardPrice')
        .sort({ name: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      ServiceModel.countDocuments(filter),
    ]);
    const departmentIds = validObjectIds(services.map((item) => item.departmentId));
    const departments = departmentIds.length
      ? await DepartmentModel.find({ _id: { $in: departmentIds }, deletedAt: null }).select('name branchIds').lean()
      : [];
    const branchIds = validObjectIds(departments.flatMap((department) => department.branchIds));
    const branches = branchIds.length
      ? await BranchModel.find({ _id: { $in: branchIds }, deletedAt: null }).select('name city').lean()
      : [];
    const branchById = new Map(branches.map((branch) => [String(branch._id), branch]));
    const departmentById = new Map(departments.map((department) => [String(department._id), department]));
    return {
      data: services.map((service) => {
        const department = departmentById.get(String(service.departmentId));
        const departmentBranchId = department?.branchIds.find(
          (branchId) => !query.branchId || String(branchId) === query.branchId,
        );
        const branch = departmentBranchId ? branchById.get(String(departmentBranchId)) : null;
        return {
          id: String(service._id),
          code: service.code,
          name: service.name,
          service_type: service.serviceType,
          category: service.category ?? null,
          description: service.description ?? null,
          standard_price: service.standardPrice,
          department: { id: String(service.departmentId), name: department?.name ?? 'Clinical Department' },
          branch: { id: String(branch?._id ?? 'default'), name: branch?.name ?? 'Hospital Branch', city: branch?.city ?? null },
        };
      }),
      meta: pageMeta(query.page, query.limit, total),
    };
  }

  async listPublicDoctors(query: { page: number; limit: number; search?: string; departmentId?: string; branchId?: string }) {
    const baseFilter: Record<string, unknown> = {
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };
    const andConditions: Record<string, unknown>[] = [baseFilter];
    if (query.departmentId) {
      const dId = query.departmentId;
      const validObjId = objectId(dId);
      const targetDept = validObjId ? await DepartmentModel.findById(validObjId).lean() : null;
      let matchingDeptIds: (Types.ObjectId | string)[] = validObjId ? [validObjId] : [dId];
      if (targetDept) {
        const sameNameDepts = await DepartmentModel.find({ name: targetDept.name, deletedAt: null, status: { $ne: 'INACTIVE' } }).select('_id').lean();
        matchingDeptIds = sameNameDepts.map((d) => d._id);
      }
      const deptConds: Record<string, unknown>[] = [
        { departmentId: { $in: matchingDeptIds } },
        { departmentId: { $in: matchingDeptIds.map((id) => String(id)) } },
      ];
      andConditions.push({ $or: deptConds });
    }
    if (query.branchId && !query.departmentId) {
      const bId = query.branchId;
      const validObjId = objectId(bId);
      const branchConds: Record<string, unknown>[] = [{ branchId: String(bId) }];
      if (validObjId) branchConds.push({ branchId: validObjId });
      andConditions.push({ $or: branchConds });
    }
    if (query.search) {
      const expression = new RegExp(escapeRegex(query.search), 'i');
      andConditions.push({ $or: [{ displayName: expression }, { specialization: expression }, { qualification: expression }] });
    }
    const filter = andConditions.length > 1 ? { $and: andConditions } : baseFilter;
    let [doctors, total] = await Promise.all([
      DoctorModel.find(filter)
        .select('displayName specialization qualification experienceYears branchId departmentId consultationRoom availability')
        .sort({ displayName: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      DoctorModel.countDocuments(filter),
    ]);

    if (!doctors.length) {
      [doctors, total] = await Promise.all([
        DoctorModel.find(baseFilter)
          .select('displayName specialization qualification experienceYears branchId departmentId consultationRoom availability')
          .sort({ displayName: 1 })
          .skip((query.page - 1) * query.limit)
          .limit(query.limit)
          .lean(),
        DoctorModel.countDocuments(baseFilter),
      ]);
    }

    const branchIds = validObjectIds(doctors.map((item) => item.branchId));
    const departmentIds = validObjectIds(doctors.map((item) => item.departmentId));
    const [branches, departments] = await Promise.all([
      branchIds.length ? BranchModel.find({ _id: { $in: branchIds }, deletedAt: null }).select('name city').lean() : [],
      departmentIds.length ? DepartmentModel.find({ _id: { $in: departmentIds }, deletedAt: null }).select('name').lean() : [],
    ]);
    const branchById = new Map(branches.map((branch) => [String(branch._id), branch]));
    const departmentById = new Map(departments.map((department) => [String(department._id), department.name]));
    return {
      data: doctors.map((doctor) => {
        const branch = branchById.get(String(doctor.branchId));
        const departmentName = departmentById.get(String(doctor.departmentId));
        return {
          id: String(doctor._id),
          display_name: doctor.displayName,
          specialization: doctor.specialization,
          qualification: doctor.qualification ?? null,
          experience_years: doctor.experienceYears ?? null,
          consultation_room: doctor.consultationRoom ?? null,
          available_days: doctor.availability.filter((item) => item.isAvailable).map((item) => item.dayOfWeek),
          branch: { id: String(doctor.branchId), name: branch?.name ?? 'Hospital Branch', city: branch?.city ?? null },
          department: { id: String(doctor.departmentId), name: departmentName ?? 'Clinical Department' },
        };
      }),
      meta: pageMeta(query.page, query.limit, total),
    };
  }

  async getPortalAccount(userId: string) {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('fullName email phone patientId roleIds')
      .lean();
    if (!user) return null;
    const roles = await RoleModel.find({ _id: { $in: user.roleIds ?? [] }, status: 'active', deletedAt: null })
      .select('code')
      .lean();
    const roleCodes = roles.map((role) => role.code);
    const accountType = roleCodes.includes('GUARDIAN') ? 'GUARDIAN' : roleCodes.includes('PATIENT') ? 'PATIENT' : null;
    return accountType ? {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email ?? null,
      phone: user.phone ?? null,
      patientId: user.patientId ? String(user.patientId) : null,
      accountType,
    } : null;
  }

  async listAccessiblePatients(userId: string) {
    const account = await this.getPortalAccount(userId);
    if (!account) return null;
    const grants = await PatientAccessGrantModel.find({ userId: objectId(userId), status: 'VERIFIED', revokedAt: null })
      .sort({ isPrimary: -1, createdAt: 1 })
      .lean();
    if (account.patientId && !grants.some((grant) => String(grant.patientId) === account.patientId)) {
      grants.unshift({ patientId: objectId(account.patientId), relationship: 'SELF', status: 'VERIFIED', isPrimary: true } as (typeof grants)[number]);
    }
    const patients = await PatientModel.find({
      _id: { $in: grants.map((grant) => grant.patientId) },
      status: 'ACTIVE',
      deletedAt: null,
    }).select('patientNumber firstName middleName lastName dateOfBirth gender registrationBranchId').lean();
    const patientById = new Map(patients.map((patient) => [String(patient._id), patient]));
    const branchIds = [...new Set(patients.map((patient) => patient.registrationBranchId ? String(patient.registrationBranchId) : null).filter((id): id is string => Boolean(id)))];
    const branches = await BranchModel.find({ _id: { $in: branchIds }, status: 'ACTIVE', deletedAt: null }).select('name city address').lean();
    const branchById = new Map(branches.map((branch) => [String(branch._id), branch]));
    const guardianProfile = account.accountType === 'GUARDIAN'
      ? await GuardianProfileModel.findOne({ userId: objectId(userId) }).lean()
      : null;
    return {
      account: {
        type: account.accountType,
        full_name: account.fullName,
        email: account.email,
        phone: account.phone,
        guardian_profile: guardianProfile ? {
          relationship: guardianProfile.relationship,
          address: guardianProfile.address ?? {},
          identification: guardianProfile.identification ?? {},
          legal_consent_accepted: guardianProfile.legalConsentAccepted,
          legal_consent_accepted_at: guardianProfile.legalConsentAcceptedAt,
        } : null,
      },
      patients: grants.flatMap((grant) => {
        const patient = patientById.get(String(grant.patientId));
        const branch = patient?.registrationBranchId ? branchById.get(String(patient.registrationBranchId)) : null;
        return patient ? [{
          id: String(patient._id),
          patient_number: patient.patientNumber,
          full_name: [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' '),
          date_of_birth: patient.dateOfBirth,
          gender: patient.gender,
          relationship: grant.relationship,
          is_primary: grant.isPrimary,
          preferred_branch: branch ? { id: String(branch._id), name: branch.name, city: branch.city ?? null, address: branch.address ?? null } : null,
        }] : [];
      }),
    };
  }

  async resolveAccessiblePatientId(userId: string, requestedPatientId?: string) {
    const context = await this.listAccessiblePatients(userId);
    if (!context) return null;
    if (requestedPatientId) return context.patients.some((patient) => patient.id === requestedPatientId) ? requestedPatientId : null;
    return context.patients[0]?.id ?? null;
  }

  async getLinkedPatientId(userId: string) {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('patientId roleIds')
      .lean();
    if (!user?.patientId) return null;

    const hasPatientRole = Boolean(await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'PATIENT',
      status: 'active',
      deletedAt: null,
    }));
    return hasPatientRole ? String(user.patientId) : null;
  }

  async hasPatientMatchingContact(email: string, phone: string) {
    const phoneFilter = buildPhoneMongoFilter(phone);
    return Boolean(await PatientModel.exists({
      deletedAt: null,
      $or: [
        { email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        phoneFilter,
      ],
    }));
  }

  async getUnlinkedPatientLoginStatus(phone: string) {
    const phoneFilter = buildPhoneMongoFilter(phone);
    const portalAccountExists = await UserModel.exists({
      deletedAt: null,
      ...phoneFilter,
    });
    if (portalAccountExists) return null;

    const patients = await PatientModel.find({
      deletedAt: null,
      status: 'ACTIVE',
      ...phoneFilter,
    }).select('dateOfBirth').limit(2).lean();
    if (patients.length === 0) return 'NEW_PATIENT_REQUIRES_REGISTRATION' as const;
    if (patients.length > 1) return 'MULTIPLE_PATIENT_MATCHES' as const;

    const patient = patients[0]!;
    const linkedPortalOwnerExists = Boolean(await UserModel.exists({
      patientId: patient._id,
      status: 'active',
      deletedAt: null,
    }));
    if (linkedPortalOwnerExists) return null;

    const adultDate = new Date(patient.dateOfBirth);
    adultDate.setFullYear(adultDate.getFullYear() + 18);
    return adultDate > new Date() ? 'MINOR_REQUIRES_GUARDIAN' as const : 'ACCOUNT_NOT_LINKED' as const;
  }

  async getUniqueUnlinkedAdultPatientByPhone(phone: string) {
    const phoneFilter = buildPhoneMongoFilter(phone);
    const patients = await PatientModel.find({
      deletedAt: null,
      status: 'ACTIVE',
      ...phoneFilter,
    }).select('firstName middleName lastName dateOfBirth email patientNumber').limit(2).lean();
    if (patients.length !== 1) return null;

    const patient = patients[0]!;
    const adultDate = new Date(patient.dateOfBirth);
    adultDate.setFullYear(adultDate.getFullYear() + 18);
    if (adultDate > new Date()) return null;

    const alreadyLinked = await Promise.all([
      UserModel.exists({ patientId: patient._id, deletedAt: null }),
      PatientAccessGrantModel.exists({ patientId: patient._id, status: 'VERIFIED', deletedAt: null }),
    ]);
    if (alreadyLinked.some(Boolean)) return null;

    const patientEmail = patient.email?.trim().toLowerCase();
    const emailInUse = patientEmail
      ? await UserModel.exists({ email: new RegExp(`^${escapeRegex(patientEmail)}$`, 'i'), deletedAt: null })
      : true;
    return {
      id: String(patient._id),
      patientNumber: patient.patientNumber,
      fullName: [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' '),
      portalEmail: patientEmail && !emailInUse ? patientEmail : `patient-${String(patient._id)}@portal.hms.invalid`,
    };
  }

  async getUnlinkedMinorByPhone(phone: string) {
    const phoneFilter = buildPhoneMongoFilter(phone);
    if (await UserModel.exists({ deletedAt: null, ...phoneFilter })) return null;

    const patients = await PatientModel.find({
      deletedAt: null,
      status: 'ACTIVE',
      ...phoneFilter,
    }).select('firstName lastName dateOfBirth').limit(2).lean();
    if (patients.length !== 1) return null;

    const patient = patients[0]!;
    const adultDate = new Date(patient.dateOfBirth);
    adultDate.setFullYear(adultDate.getFullYear() + 18);
    if (adultDate <= new Date()) return null;

    return {
      id: String(patient._id),
      fullName: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
    };
  }

  async auditGuardianLink(userId: string, patientId: string, relationship: PatientAccessRelationship, session?: ClientSession) {
    await AuditLogModel.create(
      [
        {
          eventType: 'patient_portal.guardian.linked',
          actorUserId: userId,
          subjectUserId: userId,
          metadataJson: { patientId, relationship },
        },
      ],
      session ? { session } : undefined,
    );
  }

  async upsertGuardianProfile(
    userId: string,
    input: {
      fullName: string;
      phone: string;
      email: string;
      relationship: GuardianRelationship;
      address?: { line1?: string | null; city?: string | null; state?: string | null; country?: string | null; postalCode?: string | null };
      identification?: { type?: string | null; number?: string | null };
      legalConsentAccepted: boolean;
    },
    session?: ClientSession,
  ) {
    return GuardianProfileModel.findOneAndUpdate(
      { userId: objectId(userId) },
      {
        $set: {
          fullName: input.fullName.trim(), phone: input.phone.trim(), email: input.email.trim().toLowerCase(),
          relationship: input.relationship, address: input.address ?? {}, identification: input.identification ?? {},
          legalConsentAccepted: input.legalConsentAccepted,
          legalConsentAcceptedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after', session },
    ).lean();
  }

  async updateGuardianProfile(userId: string, patientId: string, input: {
    fullName: string;
    relationship: GuardianRelationship;
    address?: { line1?: string | null; city?: string | null; state?: string | null; country?: string | null; postalCode?: string | null };
    identification?: { type?: string | null; number?: string | null };
  }) {
    const userObjectId = objectId(userId);
    const patientObjectId = objectId(patientId);
    const [profile, grant] = await Promise.all([
      GuardianProfileModel.findOneAndUpdate(
        { userId: userObjectId },
        { $set: {
          fullName: input.fullName.trim(),
          relationship: input.relationship,
          address: input.address ?? {},
          identification: input.identification ?? {},
        } },
        { returnDocument: 'after' },
      ).lean(),
      PatientAccessGrantModel.findOneAndUpdate(
        { userId: userObjectId, patientId: patientObjectId, status: 'VERIFIED', revokedAt: null },
        { $set: { relationship: input.relationship } },
        { returnDocument: 'after' },
      ).lean(),
      UserModel.updateOne({ _id: userObjectId, deletedAt: null }, { $set: { fullName: input.fullName.trim(), updatedBy: userObjectId } }),
    ]);
    if (!profile || !grant) return null;
    await AuditLogModel.create({
      eventType: 'patient_portal.guardian.updated',
      actorUserId: userId,
      subjectUserId: userId,
      metadataJson: { patientId, relationship: input.relationship },
    });
    return { patientId, relationship: input.relationship };
  }

  async findExistingPatientForPortal(input: { patientNumber: string; phone: string; dateOfBirth: string }) {
    const normalizedPhone = input.phone.replace(/\D/g, '');
    const patients = await PatientModel.find({
      patientNumber: input.patientNumber.trim().toUpperCase(),
      dateOfBirth: new Date(input.dateOfBirth),
      phone: { $in: [input.phone.trim(), normalizedPhone, `+${normalizedPhone}`] },
      status: 'ACTIVE', deletedAt: null,
    }).select('firstName middleName lastName dateOfBirth email phone registrationBranchId').limit(2).lean();
    return patients.length === 1 ? patients[0]! : null;
  }

  async linkPortalAccountToPatient(userId: string, patientId: string, session?: ClientSession) {
    await this.ensureAccessGrant(userId, patientId, 'SELF', session);
    await UserModel.updateOne(
      { _id: objectId(userId), deletedAt: null },
      { $set: { patientId: objectId(patientId), updatedBy: objectId(userId) } },
      { session },
    );
  }

  async findPatientToLinkAsDependent(input: { patientNumber: string; dateOfBirth: string }) {
    const patients = await PatientModel.find({
      patientNumber: input.patientNumber.trim().toUpperCase(), dateOfBirth: new Date(input.dateOfBirth),
      status: 'ACTIVE', deletedAt: null,
    }).select('firstName lastName dateOfBirth registrationBranchId').limit(2).lean();
    return patients.length === 1 ? patients[0]! : null;
  }

  async createPortalPatient(
    input: {
      userId: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
      email?: string | null;
      phone?: string | null;
      bloodGroup?: string | null;
      address?: { line1?: string | null; city?: string | null; state?: string | null; country?: string | null; postalCode?: string | null };
      relationship: PatientAccessRelationship;
      preferredBranchId: string;
    },
    session?: ClientSession,
  ) {
    const normalizedPhone = input.phone?.replace(/\D/g, '') ?? '';
    const contactFilters: Record<string, unknown>[] = [];
    if (input.email?.trim()) {
      contactFilters.push({ email: new RegExp(`^${escapeRegex(input.email.trim())}$`, 'i') });
    }
    if (normalizedPhone) {
      contactFilters.push({ phone: { $in: [input.phone, normalizedPhone, `+${normalizedPhone}`] } });
    }

    const duplicateFilter: Record<string, unknown> = {
      deletedAt: null,
      firstName: new RegExp(`^${escapeRegex(input.firstName)}$`, 'i'),
      lastName: new RegExp(`^${escapeRegex(input.lastName)}$`, 'i'),
      dateOfBirth: new Date(input.dateOfBirth),
    };

    if (contactFilters.length > 0) {
      duplicateFilter.$or = contactFilters;
    }

    const duplicateQuery = PatientModel.exists(duplicateFilter);
    const duplicate = await (session ? duplicateQuery.session(session) : duplicateQuery);
    if (duplicate) return null;

    const patientNumber = await allocatePatientNumber();
    const patientRecords = await PatientModel.create(
      [
        {
          patientNumber,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          dateOfBirth: new Date(input.dateOfBirth),
          gender: input.gender,
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          bloodGroup: input.bloodGroup?.trim() || null,
          address: input.address ?? {},
          registrationBranchId: objectId(input.preferredBranchId),
          status: 'ACTIVE',
          createdBy: objectId(input.userId),
          updatedBy: objectId(input.userId),
        },
      ],
      session ? { session } : undefined,
    );
    const patient = patientRecords[0]!;

    await Promise.all([
      PatientAccessGrantModel.create(
        [
          {
            userId: objectId(input.userId),
            patientId: patient._id,
            relationship: input.relationship,
            status: 'VERIFIED',
            isPrimary: input.relationship === 'SELF',
            verifiedBy: objectId(input.userId),
            verifiedAt: new Date(),
          },
        ],
        session ? { session } : undefined,
      ),
      PatientTimelineEventModel.create(
        [
          {
            patientId: patient._id,
            eventType: 'REGISTRATION',
            title: input.relationship === 'SELF' ? 'Patient self-registration completed' : 'Dependent registered by guardian',
            description: `${input.firstName.trim()} ${input.lastName.trim()} was registered through the patient portal.`,
            occurredAt: new Date(),
            createdBy: objectId(input.userId),
          },
        ],
        session ? { session } : undefined,
      ),
      AuditLogModel.create(
        [
          {
            eventType: 'patient_portal.patient.created',
            actorUserId: input.userId,
            metadataJson: { patientId: String(patient._id), relationship: input.relationship },
          },
        ],
        session ? { session } : undefined,
      ),
    ]);

    if (input.relationship === 'SELF') {
      await UserModel.updateOne(
        { _id: objectId(input.userId) },
        { $set: { patientId: patient._id, updatedBy: objectId(input.userId) } },
        { session },
      );
    }
    return String(patient._id);
  }

  async linkExistingSelfPatient(
    input: {
      userId: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      email?: string | null;
      phone?: string | null;
      preferredBranchId: string;
    },
    session?: ClientSession,
  ) {
    const normalizedPhone = input.phone?.replace(/\D/g, '') ?? '';
    const contactMatches: Record<string, unknown>[] = [];
    if (input.email) contactMatches.push({ email: new RegExp(`^${escapeRegex(input.email)}$`, 'i') });
    if (input.phone) contactMatches.push({ phone: { $in: [input.phone, normalizedPhone, `+${normalizedPhone}`] } });
    if (contactMatches.length === 0) return null;
    const findQuery = PatientModel.find({
      status: 'ACTIVE',
      deletedAt: null,
      firstName: new RegExp(`^${escapeRegex(input.firstName)}$`, 'i'),
      lastName: new RegExp(`^${escapeRegex(input.lastName)}$`, 'i'),
      dateOfBirth: new Date(input.dateOfBirth),
      $or: contactMatches,
    }).select('_id registrationBranchId').limit(2);
    const patients = await (session ? findQuery.session(session) : findQuery).lean();
    if (patients.length !== 1) return null;
    const patient = patients[0]!;
    await Promise.all([
      this.ensureAccessGrant(input.userId, String(patient._id), 'SELF', session),
      UserModel.updateOne(
        { _id: objectId(input.userId) },
        { $set: { patientId: patient._id, updatedBy: objectId(input.userId) } },
        { session },
      ),
      patient.registrationBranchId ? Promise.resolve() : PatientModel.updateOne(
        { _id: patient._id },
        { $set: { registrationBranchId: objectId(input.preferredBranchId), updatedBy: objectId(input.userId) } },
        { session },
      ),
      AuditLogModel.create(
        [
          {
            eventType: 'patient_portal.patient.self_linked',
            actorUserId: input.userId,
            metadataJson: { patientId: String(patient._id) },
          },
        ],
        session ? { session } : undefined,
      ),
    ]);
    return String(patient._id);
  }

  async ensureAccessGrant(userId: string, patientId: string, relationship: PatientAccessRelationship, session?: ClientSession) {
    await PatientAccessGrantModel.updateOne(
      { userId: objectId(userId), patientId: objectId(patientId) },
      { $set: { relationship, status: 'VERIFIED', isPrimary: relationship === 'SELF', verifiedAt: new Date(), revokedAt: null } },
      { upsert: true, session },
    );
  }

  async getPatientForProvisioning(patientId: string) {
    if (!Types.ObjectId.isValid(patientId)) return null;
    return PatientModel.findOne({ _id: objectId(patientId), deletedAt: null })
      .select('patientNumber firstName middleName lastName email phone registrationBranchId status')
      .lean();
  }

  async updatePortalPatient(userId: string, patientId: string, input: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
    dateOfBirth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
    email?: string | null;
    phone?: string | null;
    bloodGroup?: string | null;
    preferredBranchId: string;
    address?: { line1?: string | null; city?: string | null; state?: string | null; country?: string | null; postalCode?: string | null };
    emergencyContact?: { name?: string | null; relationship?: string | null; phone?: string | null };
  }) {
    const patient = await PatientModel.findOneAndUpdate(
      { _id: objectId(patientId), status: 'ACTIVE', deletedAt: null },
      { $set: {
        firstName: input.firstName.trim(),
        middleName: input.middleName?.trim() || null,
        lastName: input.lastName.trim(),
        dateOfBirth: new Date(input.dateOfBirth),
        gender: input.gender,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        bloodGroup: input.bloodGroup?.trim() || null,
        registrationBranchId: objectId(input.preferredBranchId),
        address: input.address ?? {},
        emergencyContact: input.emergencyContact ?? {},
        updatedBy: objectId(userId),
      } },
      { returnDocument: 'after' },
    ).select('_id patientNumber').lean();
    if (!patient) return null;
    const portalOwner = await UserModel.findOne({
      patientId: patient._id,
      deletedAt: null,
    }).select('_id').lean();
    if (portalOwner) {
      const ownerIsEditingSelf = String(portalOwner._id) === userId;
      await UserModel.updateOne(
        { _id: portalOwner._id, deletedAt: null },
        {
          $set: {
            phone: ownerIsEditingSelf ? input.phone?.trim() || null : null,
            updatedBy: objectId(userId),
          },
        },
      );
    }
    await Promise.all([
      portalOwner
        ? RefreshTokenModel.updateMany(
            { userId: portalOwner._id, revokedAt: null },
            { $set: { revokedAt: new Date() } },
          )
        : Promise.resolve(),
      PatientTimelineEventModel.create({
        patientId: patient._id,
        eventType: 'PROFILE_UPDATED',
        title: 'Personal information updated through patient portal',
        description: 'The patient or authorised guardian updated personal information.',
        occurredAt: new Date(),
        createdBy: objectId(userId),
      }),
      AuditLogModel.create({
        eventType: 'patient_portal.patient.updated',
        actorUserId: userId,
        metadataJson: { patientId: String(patient._id) },
      }),
    ]);
    return { patientId: String(patient._id), patientNumber: patient.patientNumber };
  }

  async getOverview(patientId: string) {
    const id = objectId(patientId);
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const [patient, appointments, invoices, laboratoryResults, imagingReports, prescriptions, pharmacyInvoices, upcomingCount, outstandingCount] =
      await Promise.all([
        PatientModel.findOne({ _id: id, deletedAt: null })
          .select('patientNumber firstName middleName lastName dateOfBirth gender phone email address emergencyContact bloodGroup status createdAt')
          .lean(),
        AppointmentModel.find({ patientId: id, deletedAt: null })
          .select('appointmentNumber doctorName doctorSpecialization branchId appointmentDate startTime endTime visitType status reason')
          .sort({ appointmentDate: -1, startTime: -1 })
          .limit(8)
          .lean(),
        BillingInvoiceModel.find({ patientId: id, deletedAt: null, status: { $ne: 'DRAFT' } })
          .select('invoiceNumber invoiceDate status totalAmount paidAmount balanceAmount')
          .sort({ invoiceDate: -1 })
          .limit(8)
          .lean(),
        LaboratoryResultModel.find({ patientId: id, deletedAt: null, verifiedAt: { $ne: null } })
          .select('resultItems remarks enteredAt verifiedAt')
          .sort({ verifiedAt: -1 })
          .limit(6)
          .lean(),
        ImagingReportModel.find({ patientId: id, deletedAt: null, verifiedAt: { $ne: null } })
          .select('findings impression recommendations enteredAt verifiedAt')
          .sort({ verifiedAt: -1 })
          .limit(6)
          .lean(),
        OpdPrescriptionModel.find({ patientId: id, deletedAt: null, status: { $in: ['SUBMITTED', 'DISPENSED'] } })
          .select('doctorName status items followUpDate doctorInstructions patientInstructions submittedAt createdAt')
          .sort({ submittedAt: -1, createdAt: -1 })
          .limit(12)
          .lean(),
        BillingInvoiceModel.find({ patientId: id, deletedAt: null, status: { $nin: ['DRAFT', 'CANCELLED'] } })
          .select('invoiceNumber invoiceDate status branchId')
          .sort({ invoiceDate: -1 })
          .limit(50)
          .lean(),
        AppointmentModel.countDocuments({
          patientId: id,
          deletedAt: null,
          appointmentDate: { $gte: startOfToday },
          status: { $in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] },
        }),
        BillingInvoiceModel.countDocuments({
          patientId: id,
          deletedAt: null,
          balanceAmount: { $gt: 0 },
          status: { $in: ['PENDING', 'PARTIALLY_PAID'] },
        }),
      ]);

    if (!patient) return null;
    const pharmacyItems = pharmacyInvoices.length ? await BillingInvoiceItemModel.find({
      invoiceId: { $in: pharmacyInvoices.map((invoice) => invoice._id) },
      serviceType: 'PHARMACY',
      deletedAt: null,
    }).select('invoiceId serviceName quantity unitPrice lineTotal createdAt').sort({ createdAt: -1 }).lean() : [];
    const pharmacyInvoiceById = new Map(pharmacyInvoices.map((invoice) => [String(invoice._id), invoice]));
    const appointmentBranchIds = [...new Set(appointments.map((item) => String(item.branchId)))];
    const purchaseBranchIds = [...new Set(pharmacyInvoices.map((item) => String(item.branchId)))];
    const appointmentBranches = await BranchModel.find({ _id: { $in: [...new Set([...appointmentBranchIds, ...purchaseBranchIds])] }, deletedAt: null })
      .select('name city address')
      .lean();
    const appointmentBranchById = new Map(appointmentBranches.map((branch) => [String(branch._id), branch]));
    return {
      patient: {
        id: String(patient._id),
        patient_number: patient.patientNumber,
        first_name: patient.firstName,
        middle_name: patient.middleName ?? null,
        last_name: patient.lastName,
        date_of_birth: patient.dateOfBirth,
        gender: patient.gender,
        phone: patient.phone ?? null,
        email: patient.email ?? null,
        address: patient.address ?? {},
        emergency_contact: patient.emergencyContact ?? {},
        blood_group: patient.bloodGroup ?? null,
        status: patient.status,
        created_at: patient.createdAt,
      },
      summary: {
        upcoming_appointments: upcomingCount,
        outstanding_invoices: outstandingCount,
        verified_lab_results: laboratoryResults.length,
        verified_imaging_reports: imagingReports.length,
      },
      appointments: appointments.map((item) => {
        const branch = appointmentBranchById.get(String(item.branchId));
        return {
        id: String(item._id),
        appointment_number: item.appointmentNumber,
        doctor_name: item.doctorName,
        doctor_specialization: item.doctorSpecialization,
        appointment_date: item.appointmentDate,
        start_time: item.startTime,
        end_time: item.endTime,
        visit_type: item.visitType,
        status: item.status,
        reason: item.reason ?? null,
        branch: branch ? { id: String(branch._id), name: branch.name, city: branch.city ?? null, address: branch.address ?? null } : null,
      };
      }),
      invoices: invoices.map((item) => ({
        id: String(item._id),
        invoice_number: item.invoiceNumber,
        invoice_date: item.invoiceDate,
        status: item.status,
        total_amount: item.totalAmount,
        paid_amount: item.paidAmount,
        balance_amount: item.balanceAmount,
      })),
      laboratory_results: laboratoryResults.map((item) => ({
        id: String(item._id),
        result_items: item.resultItems,
        remarks: item.remarks ?? null,
        entered_at: item.enteredAt,
        verified_at: item.verifiedAt,
      })),
      imaging_reports: imagingReports.map((item) => ({
        id: String(item._id),
        findings: item.findings,
        impression: item.impression,
        recommendations: item.recommendations ?? null,
        entered_at: item.enteredAt,
        verified_at: item.verifiedAt,
      })),
      prescriptions: prescriptions.map((prescription) => ({
        id: String(prescription._id),
        doctor_name: prescription.doctorName,
        status: prescription.status,
        submitted_at: prescription.submittedAt ?? prescription.createdAt,
        follow_up_date: prescription.followUpDate ?? null,
        doctor_instructions: prescription.doctorInstructions ?? null,
        patient_instructions: prescription.patientInstructions ?? null,
        items: prescription.items.map((item) => ({
          id: String(item._id),
          medicine_name: item.medicineName,
          strength: item.strength ?? null,
          dosage: item.dosage,
          route: item.route,
          frequency: item.frequency,
          duration: item.duration,
          quantity: item.quantity ?? null,
          instructions: item.instructions ?? null,
        })),
      })),
      purchased_medicines: pharmacyItems.flatMap((item) => {
        const invoice = pharmacyInvoiceById.get(String(item.invoiceId));
        if (!invoice) return [];
        const branch = appointmentBranchById.get(String(invoice.branchId));
        return [{
          id: String(item._id),
          medicine_name: item.serviceName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_amount: item.lineTotal,
          purchased_at: invoice.invoiceDate,
          invoice_number: invoice.invoiceNumber,
          payment_status: invoice.status,
          branch: branch ? { id: String(branch._id), name: branch.name, city: branch.city ?? null } : null,
        }];
      }),
    };
  }

  async listAppointments(patientId: string, query: {
    scope: 'upcoming' | 'past';
    status?: string;
    page: number;
    limit: number;
  }) {
    const id = objectId(patientId);
    if (!id) {
      return { data: [], meta: pageMeta(query.page, query.limit, 0) };
    }

    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const activeStatuses = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'];
    const historyStatuses = ['CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'SKIPPED', 'COMPLETED'];

    const checkedInVisitStatuses = ['READY_FOR_CONSULTATION', 'IN_CONSULTATION', 'CHECKED_IN', 'WAITING_FOR_VITALS'];
    const sortDirection: 1 | -1 = query.scope === 'upcoming' ? 1 : -1;
    const skip = (query.page - 1) * query.limit;
    const pipeline: PipelineStage[] = [
      {
        $match: {
          patientId: id,
          deletedAt: null,
          appointmentDate: { $type: 'date' },
          startTime: { $type: 'string' },
          endTime: { $type: 'string' },
        },
      },
      {
        $lookup: {
          from: OpdVisitModel.collection.name,
          let: { appointmentId: '$_id' },
          pipeline: [
            {
              $match: {
                patientId: id,
                deletedAt: null,
                $expr: { $eq: ['$appointmentId', '$$appointmentId'] },
              },
            },
            { $limit: 1 },
            { $project: { _id: 0, status: 1, visitNumber: 1 } },
          ],
          as: 'linkedVisits',
        },
      },
      { $set: { linkedVisit: { $arrayElemAt: ['$linkedVisits', 0] } } },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          appointment_number: '$appointmentNumber',
          patient_id: { $toString: '$patientId' },
          doctor_id: { $toString: '$doctorId' },
          doctor_name: '$doctorName',
          doctor_specialization: '$doctorSpecialization',
          department_id: { $toString: '$departmentId' },
          branch_id: { $toString: '$branchId' },
          appointment_date: '$appointmentDate',
          start_time: '$startTime',
          end_time: '$endTime',
          duration_minutes: '$durationMinutes',
          visit_type: '$visitType',
          status: {
            $let: {
              vars: { effectiveStatus: { $ifNull: ['$linkedVisit.status', '$status'] } },
              in: {
                $cond: [
                  { $in: ['$$effectiveStatus', checkedInVisitStatuses] },
                  'CHECKED_IN',
                  '$$effectiveStatus',
                ],
              },
            },
          },
          reason: { $ifNull: ['$reason', null] },
          rescheduled_from_id: {
            $cond: [{ $ne: [{ $ifNull: ['$rescheduledFromId', null] }, null] }, { $toString: '$rescheduledFromId' }, null],
          },
          rescheduled_to_id: {
            $cond: [{ $ne: [{ $ifNull: ['$rescheduledToId', null] }, null] }, { $toString: '$rescheduledToId' }, null],
          },
          is_opd_visit: { $gt: [{ $size: '$linkedVisits' }, 0] },
          opd_visit_number: { $ifNull: ['$linkedVisit.visitNumber', null] },
          source_order: { $literal: 0 },
        },
      },
      {
        $unionWith: {
          coll: OpdVisitModel.collection.name,
          pipeline: [
            {
              $match: {
                patientId: id,
                deletedAt: null,
                appointmentId: null,
                visitDate: { $type: 'date' },
                checkInTime: { $type: 'date' },
              },
            },
            {
              $project: {
                _id: 0,
                id: { $toString: '$_id' },
                appointment_number: '$visitNumber',
                patient_id: { $toString: '$patientId' },
                doctor_id: { $toString: '$doctorId' },
                doctor_name: '$doctorName',
                doctor_specialization: '$doctorSpecialization',
                department_id: { $toString: '$departmentId' },
                branch_id: { $toString: '$branchId' },
                appointment_date: '$visitDate',
                start_time: { $dateToString: { date: '$checkInTime', format: '%H:%M', timezone } },
                end_time: {
                  $dateToString: {
                    date: { $dateAdd: { startDate: '$checkInTime', unit: 'minute', amount: 30 } },
                    format: '%H:%M',
                    timezone,
                  },
                },
                duration_minutes: { $literal: 30 },
                visit_type: { $ifNull: ['$visitType', 'OPD_VISIT'] },
                status: { $cond: [{ $in: ['$status', checkedInVisitStatuses] }, 'CHECKED_IN', '$status'] },
                reason: { $ifNull: ['$reason', null] },
                rescheduled_from_id: { $literal: null },
                rescheduled_to_id: { $literal: null },
                is_opd_visit: { $literal: true },
                opd_visit_number: '$visitNumber',
                source_order: { $literal: 1 },
              },
            },
          ],
        },
      },
      {
        $set: {
          is_past: {
            $or: [
              { $lt: [{ $dateToString: { date: '$appointment_date', format: '%Y-%m-%d', timezone } }, today] },
              {
                $and: [
                  { $eq: [{ $dateToString: { date: '$appointment_date', format: '%Y-%m-%d', timezone } }, today] },
                  { $lte: ['$end_time', currentTime] },
                ],
              },
              { $in: ['$status', historyStatuses] },
            ],
          },
        },
      },
      {
        $match: {
          is_past: query.scope === 'past',
          ...(query.scope === 'upcoming' ? { status: { $in: activeStatuses } } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
      },
      {
        $facet: {
          data: [
            { $sort: { appointment_date: sortDirection, source_order: 1, id: 1 } },
            { $skip: skip },
            { $limit: query.limit },
            { $unset: ['is_past', 'source_order'] },
          ],
          metadata: [{ $count: 'total' }],
        },
      },
    ];

    const [result] = await AppointmentModel.aggregate<PortalAppointmentHistoryAggregation>(pipeline);
    const paginated = result?.data ?? [];
    const total = result?.metadata[0]?.total ?? 0;

    const branchIds = [...new Set(paginated.map((item) => item.branch_id))];
    const branches = await BranchModel.find({ _id: { $in: branchIds }, deletedAt: null }).select('name city address').lean();
    const branchById = new Map(branches.map((branch) => [String(branch._id), branch]));

    return {
      data: paginated.map((item) => {
        const branch = branchById.get(item.branch_id);
        return {
          ...item,
          branch: branch ? { id: String(branch._id), name: branch.name, city: branch.city ?? null, address: branch.address ?? null } : null,
        };
      }),
      meta: pageMeta(query.page, query.limit, total),
    };
  }

  async getInvoiceDetails(patientId: string, invoiceId: string) {
    if (!Types.ObjectId.isValid(patientId) || !Types.ObjectId.isValid(invoiceId)) return null;
    const invoice = await BillingInvoiceModel.findOne({
      _id: objectId(invoiceId),
      patientId: objectId(patientId),
      deletedAt: null,
      status: { $ne: 'DRAFT' },
    }).lean();
    if (!invoice) return null;

    const [items, payments, patient, branch] = await Promise.all([
      BillingInvoiceItemModel.find({ invoiceId: invoice._id, deletedAt: null })
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
      BillingPaymentModel.find({ invoiceId: invoice._id, deletedAt: null })
        .sort({ paymentDate: 1, _id: 1 })
        .lean(),
      PatientModel.findById(patientId)
        .select('patientNumber firstName middleName lastName phone email address')
        .lean(),
      BranchModel.findById(invoice.branchId)
        .select('name phone email address city state country postalCode')
        .lean(),
    ]);

    return {
      id: String(invoice._id),
      invoice_number: invoice.invoiceNumber,
      invoice_date: invoice.invoiceDate,
      status: invoice.status,
      subtotal: invoice.subtotal,
      discount_amount: invoice.discountAmount,
      tax_amount: invoice.taxAmount,
      total_amount: invoice.totalAmount,
      paid_amount: invoice.paidAmount,
      balance_amount: invoice.balanceAmount,
      patient: patient ? {
        id: String(patient._id),
        patient_number: patient.patientNumber,
        name: [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' '),
        phone: patient.phone ?? null,
        email: patient.email ?? null,
        address: patient.address ?? {},
      } : null,
      branch: branch ? {
        id: String(branch._id),
        name: branch.name,
        phone: branch.phone ?? null,
        email: branch.email ?? null,
        address: branch.address ?? null,
        city: branch.city ?? null,
        state: branch.state ?? null,
        country: branch.country ?? null,
        postal_code: branch.postalCode ?? null,
      } : null,
      items: items.map((item) => ({
        id: String(item._id),
        service_name: item.serviceName,
        service_type: item.serviceType,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
      })),
      payments: payments.map((payment) => ({
        id: String(payment._id),
        payment_number: payment.paymentNumber,
        amount: payment.amount,
        payment_method: payment.paymentMethod,
        payment_date: payment.paymentDate,
        reference_number: payment.referenceNumber ?? null,
      })),
    };
  }
}
