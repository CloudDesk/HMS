import { setServers } from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

let isConnected = false;
let connectedUrl: string | undefined;

export const connectDatabase = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    if (connectedUrl !== env.database.url) {
      throw new Error('MongoDB connection settings changed; restart before using another database');
    }
    return;
  }

  isConnected = false;

  if (env.database.dnsServers.length > 0) {
    setServers(env.database.dnsServers);
  }

  mongoose.set('autoCreate', false);
  mongoose.set('autoIndex', false);

  await mongoose.connect(env.database.url, {
    maxPoolSize: env.database.poolSize,
    serverSelectionTimeoutMS: env.database.connectTimeoutSeconds * 1000,
  });

  if (env.database.expectedDatabase && mongoose.connection.db?.databaseName !== env.database.expectedDatabase) {
    await mongoose.connection.close();
    throw new Error('Connected MongoDB database does not match MONGODB_EXPECTED_DATABASE');
  }
  isConnected = mongoose.connection.readyState === 1;
  connectedUrl = env.database.url;
};

export const closeDatabase = async () => {
  if (!isConnected && mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.connection.close();
  isConnected = false;
  connectedUrl = undefined;
};
