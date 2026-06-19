import { NextResponse } from "next/server";

/**
 * Applies strict security headers including Content-Security-Policy (CSP)
 * to a Next.js response object.
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // Define Content Security Policy restricting sources to 'self' and verified Google APIs
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' blob: data: https://lh3.googleusercontent.com;
    connect-src 'self' https://gmail.googleapis.com https://accounts.google.com https://generativelanguage.googleapis.com;
    frame-src 'self' https://accounts.google.com;
    frame-ancestors 'none';
    object-src 'none';
    base-uri 'self';
    form-action 'self' https://accounts.google.com;
  `.replace(/\s{2,}/g, ' ').trim();

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  return response;
}
