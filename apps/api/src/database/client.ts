import { setServers } from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

let isConnected = false;

export const connectDatabase = async () => {
  if (isConnected) {
    return;
  }

  try {
    if (env.database.dnsServers.length > 0) {
      setServers(env.database.dnsServers);
    }

    const db = await mongoose.connect(env.database.url, {
      maxPoolSize: env.database.poolSize,
      serverSelectionTimeoutMS: env.database.connectTimeoutSeconds * 1000,
    });

    isConnected = mongoose.connection.readyState === 1;
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }
};

export const closeDatabase = async () => {
  if (!isConnected) {
    return;
  }

  await mongoose.connection.close();
  isConnected = false;
  console.log('MongoDB connection closed');
};
