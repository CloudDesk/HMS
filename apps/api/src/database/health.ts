import { sql } from './client.js';

export type DatabaseHealth = {
  connected: true;
  database: string;
  user: string;
};

export const checkDatabaseHealth = async (): Promise<DatabaseHealth> => {
  const [row] = await sql<[{ database: string; user: string }]>`
    select
      current_database() as database,
      current_user as user
  `;

  return {
    connected: true,
    database: row.database,
    user: row.user,
  };
};
