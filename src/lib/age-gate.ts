const PROTECTED_PREFIXES = ["/dashboard", "/upload", "/creator"];
const PUBLIC_PREFIXES = ["/login", "/register", "/explore", "/forgot-password"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAgeVerificationPath(pathname: string): boolean {
  return pathname === "/verify-age" || pathname.startsWith("/verify-age/");
}

export function getPostLoginPath(ageVerified: boolean, callbackUrl?: string | null): string {
  if (!ageVerified) return "/verify-age";
  if (
    callbackUrl &&
    callbackUrl.startsWith("/") &&
    !callbackUrl.startsWith("//") &&
    !callbackUrl.startsWith("/login") &&
    !callbackUrl.startsWith("/register")
  ) {
    return callbackUrl;
  }
  return "/dashboard";
}
