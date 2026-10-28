import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { closeDatabase, connectDatabase } from '../database/client.js';

interface CollectionInspection {
  name: string;
  type: string;
  documentCount: number;
  indexCount: number;
  indexes: Array<{ name: string; key: Record<string, unknown>; unique?: boolean }>;
  hasValidator: boolean;
  isGridFS: boolean;
}

interface InspectionReport {
  timestamp: string;
  database: string;
  sourceHostRedacted: string;
  dbStats: {
    collections: number;
    views: number;
    objects: number;
    avgObjSize: number;
    dataSizeBytes: number;
    dataSizeMB: number;
    storageSizeBytes: number;
    storageSizeMB: number;
    indexes: number;
    indexSizeBytes: number;
    indexSizeMB: number;
    totalSizeBytes: number;
    totalSizeMB: number;
  };
  atlasFreeTierEvaluation: {
    limitMB: number;
    safeThresholdMB: number;
    currentStorageMB: number;
    currentIndexMB: number;
    combinedSizeMB: number;
    isCompatible: boolean;
    remainingHeadroomMB: number;
    verdict: string;
  };
  collectionSummary: {
    total: number;
    populatedCount: number;
    emptyCount: number;
    viewCount: number;
    gridFsCount: number;
  };
  collections: CollectionInspection[];
}

const REDACTED_HOST = (() => {
  const match = /^mongodb(?:\+srv)?:\/\/([^/?#]+)/.exec(env.database.url);
  if (!match) return 'unknown';
  const authority = match[1];
  const host = authority.slice(authority.lastIndexOf('@') + 1);
  return host.replace(/(^[^.]+).*/, '$1.****.mongodb.net');
})();

async function inspectDatabase(): Promise<void> {
  console.log('--- READ-ONLY DATABASE PRE-BACKUP INSPECTION ---');
  console.log(`Connecting read-only to target: ${REDACTED_HOST}`);

  await connectDatabase();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection object is unavailable');
  }

  const dbName = db.databaseName;
  console.log(`Connected database: ${dbName}`);

  if (dbName !== 'HMS_GENERAL') {
    throw new Error(`SAFETY HALT: Connected database "${dbName}" is NOT "HMS_GENERAL". Aborting.`);
  }

  // 1. db.stats()
  console.log('Fetching database stats...');
  const stats = await db.stats();

  const dataSizeMB = Number((stats.dataSize / (1024 * 1024)).toFixed(2));
  const storageSizeMB = Number((stats.storageSize / (1024 * 1024)).toFixed(2));
  const indexSizeMB = Number((stats.indexSize / (1024 * 1024)).toFixed(2));
  const totalSizeBytes = stats.storageSize + stats.indexSize;
  const totalSizeMB = Number((totalSizeBytes / (1024 * 1024)).toFixed(2));

  // Atlas Free Tier limit is 512 MB total storage (including indexes & data)
  const FREE_TIER_LIMIT_MB = 512;
  const SAFE_THRESHOLD_MB = 400;
  const isCompatible = totalSizeMB < SAFE_THRESHOLD_MB;
  const remainingHeadroomMB = Number((FREE_TIER_LIMIT_MB - totalSizeMB).toFixed(2));
  const verdict = isCompatible
    ? `PASSED: Total size (${totalSizeMB} MB) is well under Atlas Free Tier limit of ${FREE_TIER_LIMIT_MB} MB (${remainingHeadroomMB} MB headroom remaining).`
    : `WARNING / REVIEW: Total size (${totalSizeMB} MB) approaches or exceeds Atlas Free Tier limit of ${FREE_TIER_LIMIT_MB} MB.`;

  // 2. List collections
  console.log('Inspecting collections, counts, and indexes...');
  const rawCollections = await db.listCollections().toArray();
  const sortedCollections = rawCollections.sort((a, b) => a.name.localeCompare(b.name));

  const collectionDetails: CollectionInspection[] = [];
  let populatedCount = 0;
  let emptyCount = 0;
  let viewCount = 0;
  let gridFsCount = 0;

  for (const collInfo of sortedCollections) {
    const isView = collInfo.type === 'view';
    const isGridFS = collInfo.name === 'fs.files' || collInfo.name === 'fs.chunks';
    if (isView) viewCount++;
    if (isGridFS) gridFsCount++;

    const collHandle = db.collection(collInfo.name);

    let docCount = 0;
    let indexes: Array<{ name: string; key: Record<string, unknown>; unique?: boolean }> = [];

    try {
      docCount = await collHandle.countDocuments();
    } catch (err) {
      console.warn(`Could not count documents for ${collInfo.name}:`, (err as Error).message);
    }

    if (docCount > 0) {
      populatedCount++;
    } else {
      emptyCount++;
    }

    try {
      const rawIndexes = await collHandle.indexes();
      indexes = rawIndexes.map((idx) => ({
        name: idx.name ?? '',
        key: idx.key,
        unique: idx.unique,
      }));
    } catch {
      // Views do not have direct indexes
    }

    const hasValidator = Boolean(collInfo.options?.validator);

    collectionDetails.push({
      name: collInfo.name,
      type: collInfo.type || 'collection',
      documentCount: docCount,
      indexCount: indexes.length,
      indexes,
      hasValidator,
      isGridFS,
    });
  }

  const report: InspectionReport = {
    timestamp: new Date().toISOString(),
    database: dbName,
    sourceHostRedacted: REDACTED_HOST,
    dbStats: {
      collections: stats.collections,
      views: stats.views ?? 0,
      objects: stats.objects,
      avgObjSize: stats.avgObjSize ?? 0,
      dataSizeBytes: stats.dataSize,
      dataSizeMB,
      storageSizeBytes: stats.storageSize,
      storageSizeMB,
      indexes: stats.indexes,
      indexSizeBytes: stats.indexSize,
      indexSizeMB,
      totalSizeBytes,
      totalSizeMB,
    },
    atlasFreeTierEvaluation: {
      limitMB: FREE_TIER_LIMIT_MB,
      safeThresholdMB: SAFE_THRESHOLD_MB,
      currentStorageMB: storageSizeMB,
      currentIndexMB: indexSizeMB,
      combinedSizeMB: totalSizeMB,
      isCompatible,
      remainingHeadroomMB,
      verdict,
    },
    collectionSummary: {
      total: sortedCollections.length,
      populatedCount,
      emptyCount,
      viewCount,
      gridFsCount,
    },
    collections: collectionDetails,
  };

  // Ensure output directory exists
  const outDir = path.resolve('artifacts/mongodb-migration-preflight');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'hms-general-live-inspection.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log('\n=== PRE-BACKUP INSPECTION SUMMARY ===');
  console.log(`Database:              ${report.database}`);
  console.log(`Host (Redacted):       ${report.sourceHostRedacted}`);
  console.log(`Total Collections:     ${report.collectionSummary.total} (${populatedCount} populated, ${emptyCount} empty, ${viewCount} views)`);
  console.log(`Total Documents:       ${report.dbStats.objects}`);
  console.log(`Data Size:             ${dataSizeMB} MB`);
  console.log(`Storage Size:          ${storageSizeMB} MB`);
  console.log(`Index Size:            ${indexSizeMB} MB`);
  console.log(`Combined Size:         ${totalSizeMB} MB`);
  console.log(`Atlas Free Tier Check: ${verdict}`);
  console.log(`GridFS Collections:    ${gridFsCount > 0 ? 'Found GridFS' : 'None'}`);
  console.log(`Full Inspection Saved: ${outPath}`);
  console.log('=====================================\n');
}

try {
  await inspectDatabase();
} catch (error) {
  console.error('Inspection failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
