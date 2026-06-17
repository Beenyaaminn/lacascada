import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

async function sql(strings, ...values) {
  let text = strings[0];
  const params = [];
  for (let i = 0; i < values.length; i++) {
    params.push(values[i]);
    text += `$${i + 1}` + strings[i + 1];
  }
  const result = await pool.query(text, params);
  return result.rows;
}

await sql`UPDATE mesas SET estado = 'libre', tomada_por = NULL, tomada_desde = NULL`;
console.log('Todas las mesas reiniciadas a libre.');
process.exit(0);
