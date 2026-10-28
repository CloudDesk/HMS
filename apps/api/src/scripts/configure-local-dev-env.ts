import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd(), process.cwd().endsWith('api') ? '../..' : '.');
const DEST_ENV_PATH = path.join(REPO_ROOT, 'backups/destination.env');
const DEV_ENV_PATH = path.join(REPO_ROOT, 'apps/api/.env.dev');

async function updateDevEnv() {
  console.log('--- UPDATING LOCAL DEVELOPMENT CONFIGURATION (LOCAL DEV ONLY) ---');
  
  // 1. Read destination URI
  const destContent = await fs.readFile(DEST_ENV_PATH, 'utf-8');
  const destMatch = /^(?:DESTINATION_MONGODB_URI|MONGODB_URI)=["']?([^"'\r\n]+)["']?/m.exec(destContent);
  if (!destMatch || !destMatch[1]) {
    throw new Error('Could not find DESTINATION_MONGODB_URI in backups/destination.env');
  }
  const destinationUri = destMatch[1].trim();

  // Validate destination host before writing
  const hostMatch = /^mongodb(?:\+srv)?:\/\/([^/?#]+)(?:\/([^?#]*))?/.exec(destinationUri);
  if (!hostMatch) throw new Error('Invalid destination URI format');
  const authority = hostMatch[1];
  const host = authority.slice(authority.lastIndexOf('@') + 1).toLowerCase();
  const dbName = decodeURIComponent(hostMatch[2] ?? '');

  if (host !== 'cluster0.nzo7vdu.mongodb.net') {
    throw new Error(`SAFETY ERROR: Host is ${host}, expected cluster0.nzo7vdu.mongodb.net`);
  }
  if (dbName !== 'HMS_GENERAL') {
    throw new Error(`SAFETY ERROR: Database is ${dbName}, expected HMS_GENERAL`);
  }

  // 2. Read existing .env.dev
  const devEnvRaw = await fs.readFile(DEV_ENV_PATH, 'utf-8');
  let lines = devEnvRaw.split(/\r?\n/);

  // Update MONGODB_DATABASE_URL or MONGODB_URI
  let foundUrl = false;
  let foundHostGuard = false;
  let foundDbGuard = false;

  lines = lines.map((line) => {
    if (/^MONGODB_DATABASE_URL=/.test(line)) {
      foundUrl = true;
      return `MONGODB_DATABASE_URL=${destinationUri}`;
    }
    if (/^MONGODB_URI=/.test(line)) {
      // Remove or comment out to prevent conflict
      return `# MONGODB_URI removed to prevent conflict with MONGODB_DATABASE_URL`;
    }
    if (/^MONGODB_EXPECTED_HOST=/.test(line)) {
      foundHostGuard = true;
      return `MONGODB_EXPECTED_HOST=cluster0.nzo7vdu.mongodb.net`;
    }
    if (/^MONGODB_EXPECTED_DATABASE=/.test(line)) {
      foundDbGuard = true;
      return `MONGODB_EXPECTED_DATABASE=HMS_GENERAL`;
    }
    return line;
  });

  if (!foundUrl) {
    lines.push(`MONGODB_DATABASE_URL=${destinationUri}`);
  }
  if (!foundHostGuard) {
    lines.push(`MONGODB_EXPECTED_HOST=cluster0.nzo7vdu.mongodb.net`);
  }
  if (!foundDbGuard) {
    lines.push(`MONGODB_EXPECTED_DATABASE=HMS_GENERAL`);
  }

  await fs.writeFile(DEV_ENV_PATH, lines.join('\n'), 'utf-8');
  console.log(`Updated: ${DEV_ENV_PATH}`);
  console.log(`Configured MONGODB_EXPECTED_HOST=cluster0.nzo7vdu.mongodb.net`);
  console.log(`Configured MONGODB_EXPECTED_DATABASE=HMS_GENERAL`);
  console.log(`Successfully configured apps/api/.env.dev with destination cluster (credentials redacted).`);
}

updateDevEnv().catch((err) => {
  console.error('Update failed:', err.message);
  process.exitCode = 1;
});
