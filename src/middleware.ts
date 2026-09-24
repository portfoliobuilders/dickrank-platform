import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

const publicRoutes = ['/', '/login', '/register', '/explore'];
const adultRoutes = ['/dashboard', '/upload', '/profile', '/messages', '/creator', '/discovery', '/feed', '/content'];

function matchesRoute(pathname: string, route: string): boolean {
  if (route === '/') return pathname === '/';
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const { token } = req.nextauth;

    if (publicRoutes.some((route) => matchesRoute(pathname, route))) {
      return NextResponse.next();
    }

    const ageVerified = token?.ageVerified === true || token?.ageVerification === true;
    if (adultRoutes.some((route) => matchesRoute(pathname, route)) && !ageVerified) {
      return NextResponse.redirect(new URL('/verify-age', req.url));
    }

    if (matchesRoute(pathname, '/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ req, token }) {
        const { pathname } = req.nextUrl;
        if (publicRoutes.some((route) => matchesRoute(pathname, route))) return true;
        if (!token) return false;
        return true;
      },
    },
  },
);

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/upload',
    '/upload/:path*',
    '/profile',
    '/profile/:path*',
    '/messages',
    '/messages/:path*',
    '/admin',
    '/admin/:path*',
    '/api/protected/:path*',
    '/creator',
    '/creator/:path*',
    '/discovery',
    '/discovery/:path*',
    '/feed',
    '/feed/:path*',
    '/content/:path*',
    '/verify-age',
    '/verify-age/:path*',
  ],
};
