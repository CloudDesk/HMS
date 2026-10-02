/**
 * Dental Service Catalogue Seed
 *
 * Idempotently inserts standard Dental procedure entries into the HMS Service Catalogue.
 * Services are associated with a Dental department resolved at runtime by name pattern.
 *
 * Safe to run multiple times — uses upsert by `code` and never modifies existing prices.
 *
 * Usage (standalone script): npm run seed:dental-services --workspace=@hms/api
 * Usage (in code):           import { seedDentalServices } from './seed-dental-services.js'
 */

import { DepartmentModel } from '../modules/departments/department.model.js';
import { ServiceModel } from '../modules/services/service.model.js';
import type { Types } from 'mongoose';

// ─── Dental Procedure Definitions ────────────────────────────────────────────
// Prices are in the system currency (default: KES).
// serviceType is always PROCEDURE for clinical dental work.
// defaultDurationMinutes and bookingCapacity are required for PROCEDURE type.

type DentalServiceDefinition = {
  code: string;
  name: string;
  category: string;
  description: string;
  standardPrice: number;
  defaultDurationMinutes: number;
  bookingCapacity: number;
};

const DENTAL_SERVICES: DentalServiceDefinition[] = [
  // ── Restorative ──────────────────────────────────────────────────────────
  {
    code: 'DENT-REST-COMPOSITE',
    name: 'Direct Composite Filling',
    category: 'Restorative',
    description: 'Tooth-coloured composite resin restoration for carious lesions and minor fractures.',
    standardPrice: 3500,
    defaultDurationMinutes: 45,
    bookingCapacity: 2,
  },
  {
    code: 'DENT-REST-GIC',
    name: 'Glass Ionomer Filling',
    category: 'Restorative',
    description: 'Glass ionomer cement (GIC) restoration for cervical lesions, primary teeth, or fluoride-releasing needs.',
    standardPrice: 2000,
    defaultDurationMinutes: 30,
    bookingCapacity: 3,
  },
  {
    code: 'DENT-REST-TEMP',
    name: 'Temporary Filling',
    category: 'Restorative',
    description: 'Provisional temporary filling material placed between clinical visits.',
    standardPrice: 800,
    defaultDurationMinutes: 20,
    bookingCapacity: 4,
  },

  // ── Endodontics ───────────────────────────────────────────────────────────
  {
    code: 'DENT-ENDO-RCT',
    name: 'Root Canal Treatment',
    category: 'Endodontics',
    description: 'Complete root canal therapy including pulp extirpation, instrumentation, obturation, and final restoration.',
    standardPrice: 12000,
    defaultDurationMinutes: 90,
    bookingCapacity: 1,
  },
  {
    code: 'DENT-ENDO-CONSULT',
    name: 'RCT Consultation / Assessment',
    category: 'Endodontics',
    description: 'Endodontic assessment, pulp vitality testing, and treatment planning consultation.',
    standardPrice: 1500,
    defaultDurationMinutes: 30,
    bookingCapacity: 3,
  },
  {
    code: 'DENT-ENDO-RETREAT',
    name: 'Root Canal Re-treatment',
    category: 'Endodontics',
    description: 'Endodontic re-treatment of a previously root-canal-treated tooth with persistent or recurrent pathology.',
    standardPrice: 15000,
    defaultDurationMinutes: 120,
    bookingCapacity: 1,
  },

  // ── Extraction ────────────────────────────────────────────────────────────
  {
    code: 'DENT-EXT-SIMPLE',
    name: 'Simple Tooth Extraction',
    category: 'Extraction',
    description: 'Non-surgical extraction of an erupted, mobile, or uncomplicated tooth under local anaesthesia.',
    standardPrice: 2500,
    defaultDurationMinutes: 20,
    bookingCapacity: 3,
  },
  {
    code: 'DENT-EXT-SURGICAL',
    name: 'Surgical Tooth Extraction',
    category: 'Extraction',
    description: 'Surgical extraction involving sectioning of tooth, bone removal, or mucoperiosteal flap.',
    standardPrice: 6000,
    defaultDurationMinutes: 45,
    bookingCapacity: 2,
  },
  {
    code: 'DENT-EXT-WISDOM',
    name: 'Wisdom Tooth Extraction',
    category: 'Extraction',
    description: 'Extraction of impacted or semi-impacted third molar (wisdom tooth), including surgical approach if required.',
    standardPrice: 8000,
    defaultDurationMinutes: 60,
    bookingCapacity: 1,
  },

  // ── Prosthodontics ────────────────────────────────────────────────────────
  {
    code: 'DENT-PROS-CROWN',
    name: 'Crown',
    category: 'Prosthodontics',
    description: 'Full-coverage dental crown to restore a severely damaged or endodontically treated tooth.',
    standardPrice: 18000,
    defaultDurationMinutes: 60,
    bookingCapacity: 2,
  },
  {
    code: 'DENT-PROS-ZIRCONIA',
    name: 'Zirconia Crown',
    category: 'Prosthodontics',
    description: 'High-strength all-ceramic zirconia crown for superior aesthetics and durability.',
    standardPrice: 25000,
    defaultDurationMinutes: 60,
    bookingCapacity: 2,
  },
  {
    code: 'DENT-PROS-PFM',
    name: 'Porcelain-Fused-to-Metal Crown',
    category: 'Prosthodontics',
    description: 'Porcelain-fused-to-metal (PFM) crown combining the strength of metal with porcelain aesthetics.',
    standardPrice: 15000,
    defaultDurationMinutes: 60,
    bookingCapacity: 2,
  },
  {
    code: 'DENT-PROS-CROWN-PREP',
    name: 'Crown Preparation',
    category: 'Prosthodontics',
    description: 'Tooth preparation, impression taking, and temporary crown placement prior to definitive crown fabrication.',
    standardPrice: 5000,
    defaultDurationMinutes: 60,
    bookingCapacity: 2,
  },
  {
    code: 'DENT-PROS-CROWN-FIT',
    name: 'Crown Fitting / Cementation',
    category: 'Prosthodontics',
    description: 'Try-in, adjustments, and permanent cementation of a laboratory-fabricated dental crown.',
    standardPrice: 3000,
    defaultDurationMinutes: 45,
    bookingCapacity: 2,
  },
  {
    code: 'DENT-PROS-BRIDGE',
    name: 'Bridge',
    category: 'Prosthodontics',
    description: 'Fixed dental bridge to replace one or more missing teeth, supported by adjacent abutment teeth.',
    standardPrice: 40000,
    defaultDurationMinutes: 90,
    bookingCapacity: 1,
  },

  // ── Preventive / Periodontal ─────────────────────────────────────────────
  {
    code: 'DENT-PREV-SCALING',
    name: 'Dental Cleaning / Scaling',
    category: 'Preventive / Periodontal',
    description: 'Supragingival and subgingival scaling with ultrasonic and hand instruments to remove calculus and plaque.',
    standardPrice: 3000,
    defaultDurationMinutes: 45,
    bookingCapacity: 3,
  },
  {
    code: 'DENT-PREV-DEEPCLEAN',
    name: 'Deep Cleaning / Root Planing',
    category: 'Preventive / Periodontal',
    description: 'Subgingival deep scaling and root planing for the management of periodontal disease.',
    standardPrice: 6000,
    defaultDurationMinutes: 60,
    bookingCapacity: 2,
  },
  {
    code: 'DENT-PREV-FLUORIDE',
    name: 'Fluoride Treatment',
    category: 'Preventive / Periodontal',
    description: 'Topical fluoride application for caries prevention, post-scaling remineralisation, or sensitivity management.',
    standardPrice: 1000,
    defaultDurationMinutes: 15,
    bookingCapacity: 5,
  },

  // ── Diagnostic ────────────────────────────────────────────────────────────
  {
    code: 'DENT-DIAG-CONSULT',
    name: 'Dental Consultation',
    category: 'Diagnostic',
    description: 'Comprehensive dental examination, diagnosis, and personalised treatment planning consultation.',
    standardPrice: 1500,
    defaultDurationMinutes: 30,
    bookingCapacity: 4,
  },
  {
    code: 'DENT-DIAG-IOPA',
    name: 'Dental X-Ray / IOPA',
    category: 'Diagnostic',
    description: 'Intraoral periapical (IOPA) dental radiograph for evaluation of individual teeth and periapical tissues.',
    standardPrice: 500,
    defaultDurationMinutes: 10,
    bookingCapacity: 8,
  },
  {
    code: 'DENT-DIAG-OPG',
    name: 'Full Mouth X-Ray',
    category: 'Diagnostic',
    description: 'Orthopantomogram (OPG / panoramic radiograph) providing a full-mouth view of all teeth, jaws, and supporting structures.',
    standardPrice: 2500,
    defaultDurationMinutes: 15,
    bookingCapacity: 6,
  },
];

// ─── Seeder Function ──────────────────────────────────────────────────────────

export type DentalServiceSeedResult = {
  inserted: string[];
  skipped: string[];
  departmentId: string;
  departmentName: string;
};

/**
 * Seed dental services into the Service Catalogue.
 *
 * Resolves the dental department at runtime. If no active dental department is found,
 * logs a warning and returns without inserting (non-fatal — department may not exist yet).
 *
 * @param branchId  Optional — if provided, restricts department lookup to that branch.
 */
export async function seedDentalServices(branchId?: string | Types.ObjectId): Promise<DentalServiceSeedResult> {
  // 1. Find an active Dental department
  const deptQuery: Record<string, unknown> = {
    name: { $regex: /dental/i },
    status: 'ACTIVE',
    deletedAt: null,
  };
  if (branchId) {
    deptQuery.branchIds = branchId;
  }

  const dentalDept = await DepartmentModel.findOne(deptQuery)
    .select('_id name')
    .lean<{ _id: Types.ObjectId; name: string }>();

  if (!dentalDept) {
    const errorMsg =
      '[DentalServiceSeed] No active Dental department found. ' +
      'Create an active department whose name contains "Dental" and re-run this seed.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const departmentId = dentalDept._id;
  const inserted: string[] = [];
  const skipped: string[] = [];

  for (const def of DENTAL_SERVICES) {
    // Idempotent: skip if code already exists (do NOT overwrite existing prices)
    const existing = await ServiceModel.findOne({ code: def.code }).select('_id code').lean();
    if (existing) {
      skipped.push(def.code);
      continue;
    }

    await ServiceModel.create({
      code: def.code,
      name: def.name,
      serviceType: 'PROCEDURE',
      category: def.category,
      description: def.description,
      departmentId,
      standardPrice: def.standardPrice,
      defaultDurationMinutes: def.defaultDurationMinutes,
      bookingCapacity: def.bookingCapacity,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      status: 'ACTIVE',
    });

    inserted.push(def.code);
  }

  return {
    inserted,
    skipped,
    departmentId: departmentId.toString(),
    departmentName: dentalDept.name,
  };
}
