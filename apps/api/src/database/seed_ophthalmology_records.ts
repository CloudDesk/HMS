import mongoose, { Types } from 'mongoose';
import { ServiceModel } from '../modules/services/service.model.js';
import { MedicineModel } from '../modules/medicines/medicine.model.js';
import {
  PharmacyMedicineInventoryModel,
  PharmacyMedicineBatchModel,
} from '../modules/pharmacy-inventory/pharmacy-inventory.model.js';

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGODB_DATABASE_URL ||
  'mongodb+srv://cloudrte_db_user:0bmbhE0r8ccRd3sS@cluster0.tldvbve.mongodb.net/HMS_GENERAL?appName=Cluster0';

async function seedOphthalmologyRecords() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed');
  }

  // 1. Get or confirm Ophthalmology Department and Main Branch
  const dept = await db.collection('departments').findOne({ code: 'OPT' });
  if (!dept) {
    throw new Error('Ophthalmology department (code: OPT) not found');
  }
  const ophthalmologyDeptId = dept._id;
  console.log(`Using Ophthalmology Department: ${dept.name} (${ophthalmologyDeptId})`);

  const branch = await db.collection('branches').findOne({ code: 'MB01' });
  const mainBranchId = branch ? branch._id : new Types.ObjectId('6a7c495d94e1a711fb3d7b23');
  console.log(`Using Branch: ${branch?.name || 'Main Branch'} (${mainBranchId})`);

  // ==========================================
  // 1. PROCEDURES / SURGERIES (6 Records)
  // ==========================================
  const proceduresData = [
    {
      code: 'OPH-PROC-001',
      name: 'Phacoemulsification with Foldable Posterior Chamber IOL (OD/OS)',
      serviceType: 'PROCEDURE',
      category: 'Cataract & Anterior Segment',
      description:
        'Micro-incision ultrasonic cataract extraction with implantation of foldable acrylic posterior chamber intraocular lens under topical/peribulbar anesthesia.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 45000,
      defaultDurationMinutes: 45,
      bookingCapacity: 8,
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: true,
      minimumAdvanceDepositAmount: 15000,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-PROC-002',
      name: 'Small Incision Cataract Surgery (SICS) with Rigid PMMA IOL',
      serviceType: 'PROCEDURE',
      category: 'Cataract & Anterior Segment',
      description:
        'Manual sutureless small incision cataract extraction with posterior chamber intraocular lens implantation for advanced/mature cataracts.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 28000,
      defaultDurationMinutes: 40,
      bookingCapacity: 10,
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: true,
      minimumAdvanceDepositAmount: 10000,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-PROC-003',
      name: 'Pars Plana Vitrectomy (PPV) 23G/25G with Endolaser & Gas/Oil',
      serviceType: 'PROCEDURE',
      category: 'Retina & Vitreous Surgery',
      description:
        'Posterior segment vitrectomy for rhegmatogenous retinal detachment, non-clearing vitreous hemorrhage, macular hole, or proliferative diabetic retinopathy.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 85000,
      defaultDurationMinutes: 90,
      bookingCapacity: 4,
      requiresBed: true,
      requiresConsent: true,
      requiresAdvanceDeposit: true,
      minimumAdvanceDepositAmount: 30000,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-PROC-004',
      name: 'Trabeculectomy with Mitomycin-C (MMC) Filtering Surgery',
      serviceType: 'PROCEDURE',
      category: 'Glaucoma Surgery',
      description:
        'Guarded filtering surgery with antimetabolite (Mitomycin-C 0.2-0.4 mg/ml) for medically uncontrolled primary open-angle or angle-closure glaucoma.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 50000,
      defaultDurationMinutes: 60,
      bookingCapacity: 5,
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: true,
      minimumAdvanceDepositAmount: 15000,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-PROC-005',
      name: 'Pterygium Excision with Conjunctival Limbal Autograft (CLAU)',
      serviceType: 'PROCEDURE',
      category: 'Cornea & External Eye Disease',
      description:
        'Complete surgical excision of progressive/nasal pterygium with superior conjunctival limbal autograft fixation using autologous fibrin/sutures.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 22000,
      defaultDurationMinutes: 35,
      bookingCapacity: 12,
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-PROC-006',
      name: 'Intravitreal Anti-VEGF Injection (Ranibizumab / Aflibercept)',
      serviceType: 'PROCEDURE',
      category: 'Retina & Medical Retina',
      description:
        'Sterile operating theater/minor procedure intravitreal injection under aseptic protocol for wet AMD, diabetic macular edema (DME), and RVO.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 18000,
      defaultDurationMinutes: 20,
      bookingCapacity: 20,
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
  ];

  console.log('Seeding Procedures/Surgeries...');
  for (const proc of proceduresData) {
    await ServiceModel.findOneAndUpdate(
      { code: proc.code },
      { $set: proc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  ✓ Procedure: ${proc.code} - ${proc.name}`);
  }

  // ==========================================
  // 2. LABORATORY ORDERS (6 Records)
  // ==========================================
  const labOrdersData = [
    {
      code: 'OPH-LAB-001',
      name: 'Conjunctival & Corneal Scraping with Gram Stain & KOH Smear',
      serviceType: 'LAB_TEST',
      category: 'Ocular Microbiology',
      sampleType: 'Corneal / Conjunctival Scraping',
      description:
        'Direct microscopic examination for bacterial keratitis (Gram-positive/negative) and fungal filaments (KOH/calcofluor white).',
      departmentId: ophthalmologyDeptId,
      standardPrice: 1800,
      defaultDurationMinutes: 20,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-LAB-002',
      name: 'Aqueous / Vitreous Aspirate Culture & Sensitivity (Endophthalmitis Panel)',
      serviceType: 'LAB_TEST',
      category: 'Ocular Microbiology',
      sampleType: 'Aqueous / Vitreous Aspirate',
      description:
        'Microbiological culture and automated antimicrobial susceptibility testing for suspected postoperative or endogenous endophthalmitis.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 3500,
      defaultDurationMinutes: 30,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-LAB-003',
      name: 'Glycated Hemoglobin (HbA1c) & Fasting Blood Sugar',
      serviceType: 'LAB_TEST',
      category: 'Endocrine / Medical Retina',
      sampleType: 'Venous Whole Blood (EDTA)',
      description:
        'Essential baseline and monitoring metabolic index for proliferative diabetic retinopathy and diabetic macular edema progression.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 1200,
      defaultDurationMinutes: 15,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-LAB-004',
      name: 'Erythrocyte Sedimentation Rate (ESR) & C-Reactive Protein (CRP)',
      serviceType: 'LAB_TEST',
      category: 'Inflammatory & Neuro-Ophthalmology',
      sampleType: 'Serum / Whole Blood',
      description:
        'Emergency inflammatory marker assay to rule out Giant Cell Arteritis (Arteritic Anterior Ischemic Optic Neuropathy) and systemic vasculitis.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 1400,
      defaultDurationMinutes: 15,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-LAB-005',
      name: 'Autoimmune Uveitis Panel (ANA, RF, HLA-B27 Typing)',
      serviceType: 'LAB_TEST',
      category: 'Ocular Immunology & Uveitis',
      sampleType: 'Venous Serum & EDTA Blood',
      description:
        'Targeted serological screening for ankylosing spondylitis, juvenile idiopathic arthritis, and systemic lupus associated uveitis.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 6500,
      defaultDurationMinutes: 30,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-LAB-006',
      name: 'Pre-Operative Cataract/Retinal Clearance (CBC, PT/INR, Electrolytes)',
      serviceType: 'LAB_TEST',
      category: 'Pre-Operative Diagnostic Workup',
      sampleType: 'Whole Blood / Serum / Plasma',
      description:
        'Coagulation, full blood count, and renal electrolyte safety screen prior to elective ophthalmic surgery under local or general anesthesia.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 2800,
      defaultDurationMinutes: 20,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
  ];

  console.log('Seeding Laboratory Orders...');
  for (const lab of labOrdersData) {
    await ServiceModel.findOneAndUpdate(
      { code: lab.code },
      { $set: lab },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  ✓ Lab Order: ${lab.code} - ${lab.name}`);
  }

  // ==========================================
  // 3. IMAGING ORDERS (6 Records)
  // ==========================================
  const imagingOrdersData = [
    {
      code: 'OPH-IMG-001',
      name: 'High-Definition Spectral-Domain OCT (Macula & Optic Nerve Head) OU',
      serviceType: 'IMAGING_SERVICE',
      category: 'Ophthalmic Tomography & Diagnostics',
      description:
        'High-resolution cross-sectional retinal layer thickness, RNFL analysis, and ganglion cell complex scan for glaucoma and macular diseases.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 5000,
      defaultDurationMinutes: 20,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-IMG-002',
      name: 'Fundus Fluorescein Angiography (FFA) Dynamic Retinal Vascular Study',
      serviceType: 'IMAGING_SERVICE',
      category: 'Retinal Angiography',
      description:
        'Intravenous fluorescein dye transit photography for choroidal neovascularization, diabetic microaneurysms, and capillary non-perfusion.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 8500,
      defaultDurationMinutes: 45,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-IMG-003',
      name: 'B-Scan Ophthalmic Diagnostic Ultrasonography (Posterior Segment)',
      serviceType: 'IMAGING_SERVICE',
      category: 'Ocular Ultrasound',
      description:
        '10MHz/20MHz high-frequency acoustic evaluation in dense media opacity (mature cataract, vitreous hemorrhage) to assess retinal detachment.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 3500,
      defaultDurationMinutes: 25,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-IMG-004',
      name: 'Corneal Topography & Scheimpflug Tomography (Pentacam HR)',
      serviceType: 'IMAGING_SERVICE',
      category: 'Corneal Diagnostic Imaging',
      description:
        'Anterior and posterior corneal curvature elevation maps, pachymetry mapping, and keratoconus progression screening.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 4200,
      defaultDurationMinutes: 20,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-IMG-005',
      name: 'Humphrey Automated Perimeter Visual Field Analysis (24-2 / 30-2 SITA)',
      serviceType: 'IMAGING_SERVICE',
      category: 'Perimetry & Neuro-Diagnostics',
      description:
        'Standard automated perimetry threshold evaluation of visual field sensitivity for glaucoma progression and neuro-ophthalmic defects.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 3000,
      defaultDurationMinutes: 30,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
    {
      code: 'OPH-IMG-006',
      name: 'Anterior Segment OCT (AS-OCT) — Iridocorneal Angle & Flap Assessment',
      serviceType: 'IMAGING_SERVICE',
      category: 'Ophthalmic Tomography & Diagnostics',
      description:
        'Non-contact high-resolution imaging of the anterior chamber angle, trabecular meshwork clearance, and corneal depth measurements.',
      departmentId: ophthalmologyDeptId,
      standardPrice: 4500,
      defaultDurationMinutes: 20,
      bookingCapacity: null,
      requiresBed: false,
      requiresConsent: false,
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: null,
      status: 'ACTIVE',
    },
  ];

  console.log('Seeding Imaging Orders...');
  for (const img of imagingOrdersData) {
    await ServiceModel.findOneAndUpdate(
      { code: img.code },
      { $set: img },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  ✓ Imaging Order: ${img.code} - ${img.name}`);
  }

  // ==========================================
  // 4. MEDICINES & PHARMACY INVENTORY (6 Records)
  // ==========================================
  const medicinesData = [
    {
      code: 'MED-OPH-001',
      name: 'Moxifloxacin 0.5% Ophthalmic Solution',
      genericName: 'Moxifloxacin Hydrochloride',
      strength: '0.5% w/v (5mg/ml)',
      dosageForm: 'Eye Drops',
      unit: '5ml Bottle',
      description:
        '4th generation fluoroquinolone broad-spectrum antibacterial eye drop for post-operative prophylaxis and bacterial conjunctivitis.',
      status: 'ACTIVE',
      batchNumber: 'MOX-2026A',
      unitPrice: 850,
      quantityOnHand: 120,
      expiryDate: new Date('2028-06-30'),
    },
    {
      code: 'MED-OPH-002',
      name: 'Prednisolone Acetate 1% Ophthalmic Suspension',
      genericName: 'Prednisolone Acetate',
      strength: '1% (10mg/ml)',
      dosageForm: 'Eye Drops',
      unit: '5ml Bottle',
      description:
        'Potent topical corticosteroid for controlling post-operative intraocular inflammation, anterior uveitis, and corneal graft rejection.',
      status: 'ACTIVE',
      batchNumber: 'PRED-2026B',
      unitPrice: 950,
      quantityOnHand: 95,
      expiryDate: new Date('2027-11-30'),
    },
    {
      code: 'MED-OPH-003',
      name: 'Timolol Maleate 0.5% Ophthalmic Solution',
      genericName: 'Timolol Maleate',
      strength: '0.5% w/v',
      dosageForm: 'Eye Drops',
      unit: '5ml Bottle',
      description:
        'Non-selective beta-adrenergic receptor antagonist to reduce elevated intraocular pressure in glaucoma and ocular hypertension.',
      status: 'ACTIVE',
      batchNumber: 'TIM-2026C',
      unitPrice: 600,
      quantityOnHand: 150,
      expiryDate: new Date('2028-03-31'),
    },
    {
      code: 'MED-OPH-004',
      name: 'Latanoprost 0.005% Ophthalmic Solution',
      genericName: 'Latanoprost',
      strength: '50 mcg/ml (0.005%)',
      dosageForm: 'Eye Drops',
      unit: '2.5ml Bottle',
      description:
        'Prostaglandin F2-alpha analogue that increases uveoscleral outflow, once daily at bedtime for open-angle glaucoma.',
      status: 'ACTIVE',
      batchNumber: 'LAT-2026D',
      unitPrice: 1450,
      quantityOnHand: 80,
      expiryDate: new Date('2027-09-30'),
    },
    {
      code: 'MED-OPH-005',
      name: 'Carboxymethylcellulose 0.5% Lubricant Eye Drops',
      genericName: 'Carboxymethylcellulose Sodium',
      strength: '0.5% w/v',
      dosageForm: 'Eye Drops',
      unit: '10ml Bottle',
      description:
        'Preservative-free / gentle preservative artificial tear lubricant for dry eye syndrome, digital eye strain, and post-refractive recovery.',
      status: 'ACTIVE',
      batchNumber: 'CMC-2026E',
      unitPrice: 450,
      quantityOnHand: 200,
      expiryDate: new Date('2028-12-31'),
    },
    {
      code: 'MED-OPH-006',
      name: 'Tropicamide 0.8% + Phenylephrine 5% Eye Drops',
      genericName: 'Tropicamide + Phenylephrine Hydrochloride',
      strength: '0.8% / 5%',
      dosageForm: 'Eye Drops',
      unit: '5ml Bottle',
      description:
        'Combined mydriatic and cycloplegic agent for rapid pupillary dilation during comprehensive fundus examination and pre-operative evaluation.',
      status: 'ACTIVE',
      batchNumber: 'TRP-2026F',
      unitPrice: 750,
      quantityOnHand: 110,
      expiryDate: new Date('2028-04-30'),
    },
  ];

  console.log('Seeding Medicines & Pharmacy Inventory...');
  for (const med of medicinesData) {
    const medicineDoc = await MedicineModel.findOneAndUpdate(
      { code: med.code },
      {
        $set: {
          code: med.code,
          name: med.name,
          genericName: med.genericName,
          strength: med.strength,
          dosageForm: med.dosageForm,
          unit: med.unit,
          description: med.description,
          status: med.status,
          deletedAt: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  ✓ Medicine: ${med.code} - ${med.name}`);

    // Update or Insert Batch in Pharmacy Inventory
    await PharmacyMedicineBatchModel.findOneAndUpdate(
      { medicineId: medicineDoc._id, branchId: mainBranchId, batchNumber: med.batchNumber },
      {
        $set: {
          medicineId: medicineDoc._id,
          branchId: mainBranchId,
          batchNumber: med.batchNumber,
          expiryDate: med.expiryDate,
          unitPrice: med.unitPrice,
          quantityOnHand: med.quantityOnHand,
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true }
    );

    // Update aggregate inventory
    await PharmacyMedicineInventoryModel.findOneAndUpdate(
      { medicineId: medicineDoc._id, branchId: mainBranchId },
      {
        $set: {
          medicineId: medicineDoc._id,
          branchId: mainBranchId,
          availableQuantity: med.quantityOnHand,
          lowStockThreshold: 15,
          stockState: 'AVAILABLE',
          activeBatchCount: 1,
          expiredBatchCount: 0,
          nextExpiryDate: med.expiryDate,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`    ↳ Inventory registered: ${med.quantityOnHand} units in stock at Main Branch`);
  }

  console.log('\nAll 24 ophthalmology test records successfully seeded into MongoDB!');
  await mongoose.disconnect();
}

seedOphthalmologyRecords().catch((err) => {
  console.error('Error seeding ophthalmology records:', err);
  process.exit(1);
});
