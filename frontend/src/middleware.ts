import { NextResponse, type NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = ['/candidate', '/recruiter'];

// Routes that require specific roles
const roleRoutes: Record<string, string> = {
  '/candidate': 'candidate',
  '/recruiter': 'recruiter',
};

// Public routes (auth pages, landing)
const publicRoutes = ['/login', '/register', '/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is protected
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  // Check for auth token in cookie or header
  // Since we use localStorage-based auth (zustand persist), middleware can only
  // check a cookie hint. The real auth check happens client-side.
  // We set an 'auth-hint' cookie from the client when logging in.
  const authHint = request.cookies.get('auth-hint')?.value;

  if (!authHint) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route check
  try {
    const parsed = JSON.parse(authHint) as { role?: string };
    const requiredRole = Object.entries(roleRoutes).find(
      ([route]) => pathname.startsWith(route),
    )?.[1];

    if (requiredRole && parsed.role !== requiredRole) {
      // Redirect to appropriate dashboard
      const redirectTo = parsed.role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/onboard';
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  } catch {
    // Invalid cookie — redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/candidate/:path*', '/recruiter/:path*'],
};
