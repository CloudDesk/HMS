import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { SequenceModel } from '../shared/sequence/sequence.model.js';
import { PatientModel } from '../modules/patients/patient.model.js';
import { AppointmentModel } from '../modules/appointments/appointment.model.js';
import { OpdVisitModel } from '../modules/opd/opd-visit.model.js';
import { InpatientAdmissionModel, AdmissionRequestModel } from '../modules/inpatient-admissions/inpatient-admission.model.js';
import { ProcedureRecommendationModel, ProcedureBookingModel } from '../modules/surgery/surgery.model.js';
import { EmergencyEncounterModel } from '../modules/emergency/emergency.model.js';

async function migrate() {
  console.log('Connecting to database...');
  await mongoose.connect(env.database.url);
  console.log('Connected.');

  console.log('Migrating Standard Sequences...');
  await migrateStandardSequence('patient', PatientModel, 'patientNumber');
  await migrateStandardSequence('appointment', AppointmentModel, 'appointmentNumber');
  await migrateStandardSequence('opd_visit', OpdVisitModel, 'visitNumber');

  console.log('Migrating Timestamp Sequences...');
  await migrateTimestampSequence('admission', InpatientAdmissionModel, 'admissionNumber', 'ADM');
  await migrateTimestampSequence('admission_request', AdmissionRequestModel, 'requestNumber', 'AR');
  await migrateTimestampSequence('surgery_recommendation', ProcedureRecommendationModel, 'recommendationNumber', 'PR');
  await migrateTimestampSequence('surgery_booking', ProcedureBookingModel, 'bookingNumber', 'PB');
  await migrateTimestampSequence('emergency_encounter', EmergencyEncounterModel, 'encounterNumber', 'ER');

  console.log('Done.');
  process.exit(0);
}

async function migrateStandardSequence<T extends Record<string, unknown>>(key: string, model: mongoose.Model<T>, field: keyof T & string) {
  const all = await model.find({}, { [field]: 1 }).lean();
  let maxSeq = 0;
  for (const doc of all) {
    const val = (doc as Record<string, unknown>)[field];
    if (typeof val !== 'string') continue;
    const parts = val.split('-');
    if (parts.length >= 3) {
      const p2 = parts[2];
      if (p2) {
        const seq = parseInt(p2, 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  if (maxSeq > 0) {
    await SequenceModel.findOneAndUpdate(
      { _id: key },
      { $max: { sequence: maxSeq } },
      { new: true, upsert: true }
    );
    console.log(`Updated ${key} to max: ${maxSeq}`);
  } else {
    console.log(`No existing records found for ${key}`);
  }
}

async function migrateTimestampSequence<T extends Record<string, unknown>>(key: string, model: mongoose.Model<T>, field: keyof T & string, prefix: string) {
  const all = await model.find({}, { [field]: 1 }).lean();
  let maxSeq = 0;
  for (const doc of all) {
    const val = (doc as Record<string, unknown>)[field];
    if (typeof val !== 'string') continue;
    
    // Legacy format is PREFIX-123456789-999 (timestamp and random suffix)
    const str = val.replace(`${prefix}-`, '');
    const parts = str.split('-');
    if (parts.length === 2) {
      const p0 = parts[0];
      const p1 = parts[1];
      if (p0 && p1) {
        const ts = parseInt(p0, 10);
        const rnd = parseInt(p1, 10);
        if (!isNaN(ts) && !isNaN(rnd)) {
          if (rnd > maxSeq) {
            maxSeq = rnd;
          }
        }
      }
    }
  }

  if (maxSeq >= 0) {
    await SequenceModel.findOneAndUpdate(
      { _id: key },
      { $max: { sequence: maxSeq } },
      { new: true, upsert: true }
    );
    console.log(`Updated ${key} to max: ${maxSeq}`);
  } else {
    console.log(`No existing records found for ${key}`);
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
