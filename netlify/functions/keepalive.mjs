// Keep-alive: Netlify ejecuta esta función cada 5 minutos y hace una
// consulta mínima a Neon para evitar el "arranque en frío" (scale-to-zero)
// de la base de datos, que dejaba pagos y pedidos colgados al despertar.
import { neon } from '@neondatabase/serverless';

export default async () => {
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1`;
    console.log('keepalive: DB despierta');
  } catch (e) {
    console.error('keepalive: error consultando la BD', e);
  }
};

export const config = {
  schedule: '*/5 * * * *',
};
