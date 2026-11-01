import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import {
  INTERNAL_AUTH_HEADER,
  signInternalAuth,
  sanitizeClientHeaders,
} from '@/lib/auth/internalAuth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Sanitize incoming headers: strip any client-spoofed internal/auth headers
  const requestHeaders = sanitizeClientHeaders(request.headers);

  // Fast-path for API routes: forward sanitized headers so clients cannot spoof x-user-*
  if (pathname.startsWith('/api/')) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 2. Validate session securely against Supabase Auth
  const { supabaseResponse, user } = await updateSession(request);

  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/categories') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/imports') ||
    pathname.startsWith('/budgets') ||
    pathname.startsWith('/goals') ||
    pathname.startsWith('/advisor') ||
    pathname.startsWith('/insights') ||
    pathname.startsWith('/onboarding');
  const isAuthRoute = pathname === '/login' || pathname === '/register';

  if (pathname === '/') {
    const targetUrl = new URL(user ? '/dashboard' : '/login', request.url);
    const redirectResponse = NextResponse.redirect(targetUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (isAuthRoute && user) {
    const dashboardUrl = new URL('/dashboard', request.url);
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (user) {
    // 3. Attach cryptographically signed tamper-proof token
    const signedToken = signInternalAuth(user.id, user.email || '', user.user_metadata);
    requestHeaders.set(INTERNAL_AUTH_HEADER, signedToken);

    const nextResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      nextResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return nextResponse;
  }

  const defaultResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    defaultResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return defaultResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
