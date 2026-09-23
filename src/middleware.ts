import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAgeVerificationPath, isProtectedPath, isPublicPath } from "@/lib/age-gate";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const needsSession = isProtectedPath(pathname) || isAgeVerificationPath(pathname);
  if (!needsSession) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtectedPath(pathname) && token.ageVerified !== true) {
    return NextResponse.redirect(new URL("/verify-age", request.url));
  }

  if (isAgeVerificationPath(pathname) && token.ageVerified === true) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
