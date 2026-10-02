import mongoose from 'mongoose';
import { closeDatabase, connectDatabase } from './client.js';

async function migrate() {
  await connectDatabase();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  const collection = db.collection('departments');
  const clinicalKeywords = [
    'Cardiology',
    'General Medicine',
    'Orthopedics',
    'Pediatrics',
    'ENT',
    'Dermatology',
    'Neurology',
    'Gynecology',
    'Ophthalmology',
    'Psychiatry',
    'Emergency'
  ].map(kw => new RegExp(kw, 'i'));

  const departments = await collection.find({}).toArray();

  for (const dept of departments) {
    const isClinical = clinicalKeywords.some(regex => regex.test(dept.name));

    await collection.updateOne(
      { _id: dept._id },
      { $set: { isClinical } }
    );
  }
}

try {
  await migrate();
} finally {
  await closeDatabase();
}
