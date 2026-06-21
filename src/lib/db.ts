import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || import.meta.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL no esta configurada en las variables de entorno');
}

function buildQuery(strings: TemplateStringsArray, values: any[]): { query: string; params: any[] } {
  let query = strings[0];
  const params: any[] = [];
  for (let i = 0; i < values.length; i++) {
    params.push(values[i]);
    query += `$${i + 1}` + strings[i + 1];
  }
  return { query, params };
}

const neonQueryFn = neon(DATABASE_URL);

export async function sql(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  const { query, params } = buildQuery(strings, values);
  return (neonQueryFn as any).query(query, params) as Promise<any[]>;
}

sql.unsafe = async function (query: string, params: any[] = []): Promise<any[]> {
  return (neonQueryFn as any).query(query, params) as Promise<any[]>;
};

sql.begin = async function <T>(fn: (tx: typeof sql) => Promise<T>): Promise<T> {
  await (neonQueryFn as any).query('BEGIN', []);
  try {
    const result = await fn(sql);
    await (neonQueryFn as any).query('COMMIT', []);
    return result;
  } catch (error) {
    await (neonQueryFn as any).query('ROLLBACK', []);
    throw error;
  }
};
