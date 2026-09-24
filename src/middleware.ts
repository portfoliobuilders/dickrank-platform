import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

function isProtected(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/upload' ||
    pathname.startsWith('/upload/') ||
    pathname === '/creator' ||
    pathname.startsWith('/creator/') ||
    pathname === '/discovery' ||
    pathname.startsWith('/discovery/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  );
}

function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  if (pathname === '/login') {
    url.searchParams.set('next', request.nextUrl.pathname);
  }
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/webhooks') ||
    pathname.startsWith('/_next')
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const ageVerified = token?.ageVerification === true || token?.ageVerified === true;
  const verifyingAge = pathname === '/verify-age' || pathname.startsWith('/verify-age/');

  if (verifyingAge && !token) {
    return redirectTo(request, '/login');
  }

  if (isProtected(pathname) && !token) {
    return redirectTo(request, '/login');
  }

  if (isProtected(pathname) && token && !ageVerified) {
    return redirectTo(request, '/verify-age');
  }

  if (isAdminRoute(pathname) && token) {
    const role = String(token.role ?? '').toUpperCase();
    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      return redirectTo(request, '/');
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
