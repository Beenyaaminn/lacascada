import { Pool } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || import.meta.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL no esta configurada en las variables de entorno');
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

function isConnectionError(error: any): boolean {
  const msg = error?.message || '';
  return msg.includes('connection') ||
    msg.includes('timeout') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Connection terminated') ||
    msg.includes('connect ETIMEDOUT');
}

function buildQuery(strings: TemplateStringsArray, values: any[]): { text: string; params: any[] } {
  let text = strings[0];
  const params: any[] = [];
  for (let i = 0; i < values.length; i++) {
    params.push(values[i]);
    text += `$${i + 1}` + strings[i + 1];
  }
  return { text, params };
}

async function executeWithRetry<T>(fn: () => Promise<T>, retries: number = MAX_RETRIES): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt < retries && isConnectionError(error)) {
        console.warn(`[DB] Reintento ${attempt}/${retries} tras error de conexion...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

type TxClient = Awaited<ReturnType<typeof pool.connect>>;

let txClient: TxClient | null = null;

async function rawQuery(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  const { text, params } = buildQuery(strings, values);
  const client = txClient || pool;
  const result = await client.query(text, params);
  return result.rows;
}

export function sql(strings: TemplateStringsArray, ...values: any[]): Promise<any> {
  return executeWithRetry(() => rawQuery(strings, ...values));
}

sql.begin = async function <T>(fn: (tx: typeof sql) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  const prevTxClient = txClient;
  txClient = client;

  try {
    await client.query('BEGIN');

    const result = await fn(sql);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    txClient = prevTxClient;
    client.release();
  }
};
