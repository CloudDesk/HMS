import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function run() {
  await mongoose.connect(env.database.url);
  try {
    await mongoose.connection.collection('permissions').dropIndex('resource_1_action_1');
    console.log('Index dropped');
  } catch (err: any) {
    console.log('Error dropping index:', err.message);
  }
  await mongoose.connection.close();
}
run();
