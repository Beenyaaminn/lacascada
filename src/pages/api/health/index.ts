export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async () => {
  try {
    await sql`SELECT 1`;
    return new Response(
      JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: 'connected',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        db: 'disconnected',
        error: 'Database connection failed',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
