import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

type CookieSetOptions = Parameters<NextResponse['cookies']['set']>[2];

interface CachedSession {
  user: User | null;
  expiresAt: number;
  cookieMutations: Array<{ name: string; value: string; options?: CookieSetOptions }>;
}

// In-memory cache for verified sessions across rapid page navigations (20s TTL)
const sessionCache = new Map<string, CachedSession>();
const SESSION_CACHE_TTL_MS = 20000;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { supabaseResponse, user: null };
  }

  // 1. Fast-path: check if any Supabase auth cookies are present
  const allCookies = request.cookies.getAll();
  const authCookies = allCookies
    .filter((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (authCookies.length === 0) {
    // Unauthenticated visitor: return immediately without remote network round-trip
    return { supabaseResponse, user: null };
  }

  // 2. Fast-path: check memory cache for rapid page navigation
  const cacheKey = authCookies.map((c) => `${c.name}=${c.value}`).join(';');
  const cached = sessionCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    // Replay any session refresh cookies
    if (cached.cookieMutations && cached.cookieMutations.length > 0) {
      cached.cookieMutations.forEach(({ name, value, options }) => {
        supabaseResponse.cookies.set(name, value, options);
      });
    }
    return { supabaseResponse, user: cached.user };
  }

  // 3. Revalidate session with Supabase Auth
  const cookieMutations: Array<{ name: string; value: string; options?: CookieSetOptions }> = [];
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieMutations.push({ name, value, options });
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      if (sessionCache.size > 2000) {
        sessionCache.clear();
      }
      sessionCache.set(cacheKey, {
        user,
        expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
        cookieMutations,
      });
    }

    return { supabaseResponse, user };
  } catch (err) {
    console.error('Error in proxy updateSession:', err);
    return { supabaseResponse, user: null };
  }
}
