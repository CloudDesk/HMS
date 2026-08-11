import mongoose from 'mongoose';

export type DatabaseHealth = {
  connected: boolean;
  database: string;
};

export const checkDatabaseHealth = async (): Promise<DatabaseHealth> => {
  const isConnected = mongoose.connection.readyState === 1;
  const dbName = mongoose.connection.db ? mongoose.connection.db.databaseName : 'unknown';

  return {
    connected: isConnected,
    database: dbName,
  };
};
