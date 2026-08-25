/**
 * Safe Error Response Utility
 *
 * In development, includes error details for debugging.
 * In production, returns only generic user-facing messages.
 * NEVER exposes stack traces, file paths, DB schema, or internal architecture.
 */

/**
 * Create a safe error response for API routes.
 * @param {Error} error - The caught error
 * @param {string} userMessage - Generic message to show the user
 * @param {number} status - HTTP status code (default: 500)
 * @returns {NextResponse}
 */
export function safeErrorResponse(error, userMessage = 'Something went wrong. Please try again.', status = 500) {
  const { NextResponse } = require('next/server');

  // Log full error details server-side only
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[API ERROR] ${userMessage}:`, error?.message || error);
  }

  // Return safe message to client
  return NextResponse.json({ error: userMessage }, { status });
}

/**
 * Safe GET error handler — wraps an async GET function.
 * Catches errors and returns safe responses.
 */
export function safeGetHandler(handler) {
  return async function wrappedHandler(request) {
    try {
      return await handler(request);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[API ERROR] GET handler:', error?.message || error);
      }
      const { NextResponse } = await import('next/server');
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      );
    }
  };
}

/**
 * Safe POST error handler — wraps an async POST function.
 */
export function safePostHandler(handler) {
  return async function wrappedHandler(request) {
    try {
      return await handler(request);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[API ERROR] POST handler:', error?.message || error);
      }
      const { NextResponse } = await import('next/server');
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      );
    }
  };
}
