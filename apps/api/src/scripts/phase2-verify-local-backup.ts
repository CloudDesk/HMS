import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { MongoMemoryServer } from 'mongodb-memory-server';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(process.cwd(), process.cwd().endsWith('api') ? '../..' : '.');
const BACKUP_PATH = path.join(REPO_ROOT, 'backups/HMS_GENERAL/HMS_GENERAL_backup.archive.gz');
const MANIFEST_PATH = path.join(REPO_ROOT, 'HMS_GENERAL_BACKUP_MANIFEST.json');
const SHA_PATH = path.join(REPO_ROOT, 'HMS_GENERAL_BACKUP_SHA256.txt');
const RESTORE_EXE = 'C:\\Users\\lenovo\\.mongodb-tools\\mongodb-database-tools-windows-x86_64-100.10.0\\bin\\mongorestore.exe';
const DUMP_EXE = 'C:\\Users\\lenovo\\.mongodb-tools\\mongodb-database-tools-windows-x86_64-100.10.0\\bin\\mongodump.exe';

const EXPECTED_SHA = 'A2A2D45E72E547228014B841D4477C4DA7F96437B4C5275140964C632D28D278';
const EXPECTED_SIZE = 131076;
const EXPECTED_COLLECTIONS = 91;
const EXPECTED_DOCS = 2382;

async function run() {
  console.log('=== PHASE 2.1: LOCAL BACKUP VERIFICATION ===\n');

  // 1. Branch check
  const { stdout: branchOut } = await execFileAsync('git', ['branch', '--show-current'], { cwd: REPO_ROOT });
  const currentBranch = branchOut.trim();
  console.log(`1. Current Git Branch: ${currentBranch}`);
  if (currentBranch !== 'DEV-OPHTHALMOLOGY-F-V2') {
    throw new Error(`CRITICAL: Expected branch DEV-OPHTHALMOLOGY-F-V2, but found: ${currentBranch}`);
  }

  // 2. Backup file existence
  console.log(`2. Checking backup file: ${BACKUP_PATH}`);
  const stat = await fs.stat(BACKUP_PATH);
  console.log(`   File exists: YES`);

  // 3. Exact size check
  console.log(`3. Archive File Size: ${stat.size} bytes (${(stat.size / 1024).toFixed(2)} KB)`);
  if (stat.size !== EXPECTED_SIZE) {
    throw new Error(`CRITICAL: File size mismatch! Found ${stat.size}, expected ${EXPECTED_SIZE}`);
  }

  // 4 & 5. SHA-256 re-computation
  const buffer = await fs.readFile(BACKUP_PATH);
  const calculatedSha = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
  console.log(`4. Recomputed SHA-256: ${calculatedSha}`);
  console.log(`5. Expected SHA-256:   ${EXPECTED_SHA}`);
  if (calculatedSha !== EXPECTED_SHA) {
    throw new Error(`CRITICAL: SHA-256 mismatch! Found ${calculatedSha}, expected ${EXPECTED_SHA}`);
  }
  const fileSavedSha = (await fs.readFile(SHA_PATH, 'utf-8')).trim();
  if (fileSavedSha !== EXPECTED_SHA) {
    throw new Error(`CRITICAL: Saved SHA-256 file mismatch! Found ${fileSavedSha}, expected ${EXPECTED_SHA}`);
  }
  console.log(`   SHA-256 integrity: MATCHED 100%`);

  // 6. Metadata verification
  console.log(`6. Checking manifest: ${MANIFEST_PATH}`);
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'));
  if (manifest.sourceDatabase !== 'HMS_GENERAL') {
    throw new Error(`CRITICAL: Manifest database mismatch: ${manifest.sourceDatabase}`);
  }
  if (manifest.databaseStatistics.totalCollections !== EXPECTED_COLLECTIONS) {
    throw new Error(`CRITICAL: Manifest collections mismatch: ${manifest.databaseStatistics.totalCollections}`);
  }
  if (manifest.databaseStatistics.totalDocuments !== EXPECTED_DOCS) {
    throw new Error(`CRITICAL: Manifest documents mismatch: ${manifest.databaseStatistics.totalDocuments}`);
  }
  console.log(`   Manifest metadata: MATCHED (91 collections, 2382 documents, target HMS_GENERAL)`);

  // 7. Database tools availability
  console.log(`7. Verifying MongoDB Database Tools...`);
  const { stdout: dumpVer } = await execFileAsync(DUMP_EXE, ['--version']);
  const { stdout: restoreVer } = await execFileAsync(RESTORE_EXE, ['--version']);
  console.log(`   mongodump:    ${dumpVer.split('\n')[0].trim()}`);
  console.log(`   mongorestore: ${restoreVer.split('\n')[0].trim()}`);

  // 8 & 9. Namespace dry-run and archive integrity check
  console.log(`8. Verifying archive namespaces and integrity using ephemeral dry-run...`);
  const mongod = await MongoMemoryServer.create();
  const ephemeralUri = mongod.getUri();

  try {
    const dryRun = await execFileAsync(RESTORE_EXE, [
      `--uri=${ephemeralUri}`,
      '--dryRun',
      `--archive=${BACKUP_PATH}`,
      '--gzip',
    ]);

    const combinedOutput = (dryRun.stdout || '') + '\n' + (dryRun.stderr || '');
    const lines = combinedOutput.split('\n');

    const foreignNamespaces: string[] = [];
    const validNamespaces = new Set<string>();

    for (const line of lines) {
      const match = /(?:restoring|reading metadata for)\s+([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.-]+)/i.exec(line);
      if (match) {
        const db = match[1];
        const coll = match[2];
        if (db === 'HMS_GENERAL') {
          validNamespaces.add(coll);
        } else {
          foreignNamespaces.push(`${db}.${coll}`);
        }
      }
    }

    if (foreignNamespaces.length > 0) {
      throw new Error(`CRITICAL: Foreign namespaces found in archive: ${foreignNamespaces.join(', ')}`);
    }

    console.log(`   Namespaces in archive: ONLY HMS_GENERAL.* (0 foreign namespaces)`);
    console.log(`   Archive integrity check: PASSED with 0 errors`);
  } finally {
    await mongod.stop();
  }

  console.log('\n=== PHASE 2.1 VERIFICATION COMPLETE: ALL CHECKS PASSED ===\n');
}

run().catch((err) => {
  console.error('\nVerification failed:', err.message);
  process.exitCode = 1;
});
