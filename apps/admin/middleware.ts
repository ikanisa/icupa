import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@icupa/types/database';

const PROTECTED_PATHS = ['/', '/tenants', '/ai', '/analytics', '/compliance', '/flags', '/account'];
const AUTH_ROUTES = ['/login', '/auth/callback'];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req: request, res: response });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;

  if (!session && isProtectedPath(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    if (pathname && pathname !== '/') {
      redirectUrl.searchParams.set('redirect_to', pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (session && isAuthRoute(pathname) && pathname !== '/auth/callback') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|icons/).*)'],
};
