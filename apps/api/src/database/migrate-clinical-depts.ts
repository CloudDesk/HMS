import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://cloudrte_db_user:0bmbhE0r8ccRd3sS@cluster0.tldvbve.mongodb.net/hms?appName=Cluster0';

async function migrate() {
  console.log(`Connecting to ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

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

  console.log('Fetching departments...');
  const departments = await collection.find({}).toArray();

  let updatedCount = 0;

  for (const dept of departments) {
    const isClinical = clinicalKeywords.some(regex => regex.test(dept.name));
    console.log(`Setting ${dept.name} -> isClinical: ${isClinical}`);
    
    await collection.updateOne(
      { _id: dept._id },
      { $set: { isClinical } }
    );
    updatedCount++;
  }

  console.log(`Migration complete. Updated ${updatedCount} departments.`);
  await mongoose.disconnect();
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
