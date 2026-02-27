import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Public routes - no auth required
  const publicPaths = ['/login', '/signup', '/api/auth', '/api/health'];
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Check for next-auth session token
  const token = request.cookies.get('next-auth.session-token')?.value
    || request.cookies.get('__Secure-next-auth.session-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};
