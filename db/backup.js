import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BACKUP_DIR = resolve(__dirname, '..', 'backups');
const RETENTION_DAYS = 7;

if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no esta configurada');
  process.exit(1);
}

function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: u.username || 'postgres',
    password: u.password || '',
    database: u.pathname.replace('/', '') || 'postgres',
    ssl: u.searchParams.get('sslmode') || 'prefer',
  };
}

function cleanupOldBackups() {
  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('lacascada-backup-') && f.endsWith('.sql.gz'))
    .map(f => ({ name: f, path: resolve(BACKUP_DIR, f) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const dateStr = file.name.match(/backup-(\d{4}-\d{2}-\d{2})/)?.[1];
    if (dateStr && new Date(dateStr).getTime() < cutoff) {
      unlinkSync(file.path);
      console.log(`[CLEANUP] Eliminado backup antiguo: ${file.name}`);
    }
  }
}

async function backup() {
  const db = parseDbUrl(DATABASE_URL);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const filename = `lacascada-backup-${dateStr}-${timeStr}.sql.gz`;
  const filepath = resolve(BACKUP_DIR, filename);

  console.log(`[BACKUP] Iniciando: ${filename}`);
  console.log(`[BACKUP] Host: ${db.host}:${db.port} | BD: ${db.database}`);

  const env = { ...process.env, PGPASSWORD: db.password };

  try {
    execSync(
      `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} --no-owner --no-acl | gzip > "${filepath}"`,
      {
        env,
        stdio: 'pipe',
        timeout: 120000,
      }
    );

    const sizeMB = (require('fs').statSync(filepath).size / 1024 / 1024).toFixed(2);
    console.log(`[BACKUP] Completado: ${filename} (${sizeMB} MB)`);

    cleanupOldBackups();
    console.log(`[BACKUP] Backups retenidos: ultimos ${RETENTION_DAYS} dias`);
  } catch (e) {
    console.error(`[BACKUP] ERROR:`, e.message);
    if (e.stderr) console.error(e.stderr.toString());
    process.exit(1);
  }
}

backup();
