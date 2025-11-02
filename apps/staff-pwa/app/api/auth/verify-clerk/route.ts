import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
    let token = '';

    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      token = auth.slice(7).trim();
    } else {
      const body = await req.json().catch(() => ({}));
      token = (body?.token as string | undefined) ?? '';
    }

    if (!token) {
      return NextResponse.json({ error: { code: 'missing_token', message: 'Provide Clerk token in Authorization header or JSON body { token }' } }, { status: 400 });
    }

    const { data, error } = await supabase.functions.invoke('compliance/verify_clerk', {
      body: {},
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) {
      return NextResponse.json({ error: { code: 'verification_failed', message: error.message } }, { status: 401 });
    }

    return NextResponse.json(data ?? { ok: false }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: { code: 'internal_error', message } }, { status: 500 });
  }
}

