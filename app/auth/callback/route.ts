import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get('code'); const response = NextResponse.redirect(new URL('/', url.origin));
  if (!code) return response; const store = cookies();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => store.getAll(), setAll: values => values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } });
  await client.auth.exchangeCodeForSession(code); return response;
}
