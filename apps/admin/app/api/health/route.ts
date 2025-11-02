import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@icupa/db';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    await supabase.from('tenants').select('id', { count: 'exact', head: true });
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
