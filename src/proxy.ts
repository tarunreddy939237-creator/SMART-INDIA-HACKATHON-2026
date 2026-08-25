import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const secret = process.env.NEXTAUTH_SECRET;

/**
 * Apply security headers to every response.
 * Protects against XSS, clickjacking, MIME sniffing, and other common attacks.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }
  return response;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip Next.js internals
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return applySecurityHeaders(NextResponse.next());
  }

  // ── API route protection: require session cookie ───────────────────
  if (pathname.startsWith('/api/')) {
    const publicApiRoutes = [
      '/api/auth',
      '/api/otp/send',
      '/api/otp/verify',
      '/api/register',
      '/api/seed',
    ];
    const isPublic = publicApiRoutes.some(route => pathname.startsWith(route));

    // ── Rate limit login endpoint (Edge-compatible in-memory limiter) ──
    if (pathname === '/api/auth/callback/credentials' && req.method === 'POST') {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
      const key = `login:${ip}`;
      const now = Date.now();
      const windowMs = 15 * 60 * 1000;
      const max = 10;
      const entry = (globalThis as any).__EV_LOGIN_RL__?.get?.(key);
      if (!(globalThis as any).__EV_LOGIN_RL__) (globalThis as any).__EV_LOGIN_RL__ = new Map();
      const store = (globalThis as any).__EV_LOGIN_RL__;
      const existing = store.get(key);
      if (existing && now < existing.resetAt) {
        if (existing.count >= max) {
          const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
          return applySecurityHeaders(
            new NextResponse(JSON.stringify({ error: `Too many login attempts. Try again in ${retryAfter}s.` }), {
              status: 429,
              headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
            })
          );
        }
        existing.count++;
      } else {
        store.set(key, { count: 1, resetAt: now + windowMs });
      }
    }

    if (!isPublic) {
      const sessionCookie =
        req.cookies.get('next-auth.session-token') ||
        req.cookies.get('__Secure-next-auth.session-token');
      if (!sessionCookie) {
        return applySecurityHeaders(
          NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        );
      }
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // ── Page route protection with JWT ─────────────────────────────────
  const token = await getToken({ req, secret });

  // Unauthenticated users trying to access protected pages
  if (!token) {
    if (
      pathname.startsWith('/student') ||
      pathname.startsWith('/faculty') ||
      pathname.startsWith('/admin')
    ) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  const role = token.role as string;

  // ── Role-based route isolation ─────────────────────────────────────
  // Student trying to access faculty or admin
  if (role === 'student' && (pathname.startsWith('/faculty') || pathname.startsWith('/admin'))) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/student/dashboard', req.url))
    );
  }

  // Faculty trying to access student or admin
  if (role === 'faculty' && (pathname.startsWith('/student') || pathname.startsWith('/admin'))) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/faculty/attendance', req.url))
    );
  }

  // Admin trying to access student or faculty
  if (role === 'admin' && (pathname.startsWith('/student') || pathname.startsWith('/faculty'))) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/admin/control-tower', req.url))
    );
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
