import { setServers } from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

let isConnected = false;

export const connectDatabase = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  isConnected = false;

  if (env.database.dnsServers.length > 0) {
    setServers(env.database.dnsServers);
  }

  await mongoose.connect(env.database.url, {
    maxPoolSize: env.database.poolSize,
    serverSelectionTimeoutMS: env.database.connectTimeoutSeconds * 1000,
  });

  isConnected = mongoose.connection.readyState === 1;
};

export const closeDatabase = async () => {
  if (!isConnected && mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.connection.close();
  isConnected = false;
};
