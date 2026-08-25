import NextAuth from 'next-auth';
import authOptions from '@/lib/auth.js';

/**
 * NextAuth route handler for App Router.
 *
 * Rate limiting for login is handled in src/proxy.ts at the middleware level,
 * which correctly intercepts /api/auth/callback/credentials POST requests
 * before they reach this handler.
 *
 * Do NOT wrap the handler with a custom POST function — NextAuth v4 requires
 * the raw request object with req.query to be passed through unchanged.
 * Wrapping breaks the internal URL routing (req.query.nextauth is undefined).
 */

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
