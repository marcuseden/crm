import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    /*
     * Matcha alla sökvägar utom:
     * 1. /api (API-routes)
     * 2. /_next (Next.js interna routes)
     * 3. /_vercel (Vercel interna routes)
     * 4. /static (statiska filer)
     */
    '/((?!api|_next|_vercel|static).*)',
  ],
};

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Sätt säkerhetsheaders
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Lägg till Content-Security-Policy i produktion
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co;"
    );
  }
  
  return response;
} 