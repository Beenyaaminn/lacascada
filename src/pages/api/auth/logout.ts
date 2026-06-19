export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('lacascada_token', { path: '/' });
  return redirect('/login', 302);
};
