import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/feed', '/content', '/creator', '/profile', '/explore'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPath = PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!protectedPath) return NextResponse.next();

  const hasSession =
    Boolean(request.cookies.get('dr_session')?.value) ||
    Boolean(request.cookies.get('sb-access-token')?.value) ||
    [...request.cookies.getAll()].some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth'));

  if (!hasSession && process.env.DATA_BACKEND !== 'memory') {
    const url = request.nextUrl.clone();
    url.pathname = '/verify-age';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/feed/:path*', '/feed', '/content/:path*', '/creator/:path*', '/profile/:path*', '/explore/:path*'],
};
