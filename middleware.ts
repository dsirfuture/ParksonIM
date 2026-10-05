import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = "parksonim_session";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MiddlewareSessionPayload = {
  userId: string;
  tenantId: string;
  companyId: string;
  role: "admin" | "worker";
  userType?: "staff" | "dropshipping_customer";
  defaultPath?: string | null;
};

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function isValidSessionPayload(payload: unknown): payload is MiddlewareSessionPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return Boolean(
    typeof value.userId === "string" &&
      UUID_RE.test(value.userId) &&
      typeof value.tenantId === "string" &&
      UUID_RE.test(value.tenantId) &&
      typeof value.companyId === "string" &&
      UUID_RE.test(value.companyId) &&
      (value.role === "admin" || value.role === "worker") &&
      (value.userType === undefined ||
        value.userType === "staff" ||
        value.userType === "dropshipping_customer") &&
      (value.defaultPath === undefined ||
        value.defaultPath === null ||
        typeof value.defaultPath === "string"),
  );
}

async function readValidSessionPayload(request: NextRequest): Promise<MiddlewareSessionPayload | null> {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const [encoded, received] = raw.split(".");
  const secret = process.env.SESSION_SECRET?.trim() || "parksonim-local-session-secret";
  if (!encoded || !received || !secret) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
    const expected = Uint8Array.from(new Uint8Array(signature));
    const actual = base64UrlToBytes(received);

    if (expected.length !== actual.length) return null;
    for (let i = 0; i < expected.length; i += 1) {
      if (expected[i] !== actual[i]) return null;
    }

    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as MiddlewareSessionPayload;
    return isValidSessionPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

function hasDevSessionConfig() {
  if (process.env.NODE_ENV === "production") return false;

  const tenantId =
    process.env.DEV_TENANT_ID?.trim() || process.env.YOGO_SYNC_TENANT_ID?.trim();
  const companyId =
    process.env.DEV_COMPANY_ID?.trim() ||
    process.env.YOGO_SYNC_COMPANY_ID?.trim();

  return Boolean(
    tenantId && companyId && UUID_RE.test(tenantId) && UUID_RE.test(companyId),
  );
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.has('lang')) {
    response.cookies.set('lang', 'zh', { path: '/', maxAge: 31536000 });
  }

  const { pathname, search } = request.nextUrl;
  const isStaticAsset = /\.[a-zA-Z0-9]+$/.test(pathname);
  const isPublicCatalogRoute = pathname.startsWith("/public/catalog/");

  if (isStaticAsset || isPublicCatalogRoute) {
    return response;
  }

  const isLoginRoute = pathname === "/login";
  const isRegisterRoute = pathname === "/register";
  const sessionPayload = await readValidSessionPayload(request);
  const hasSession = Boolean(sessionPayload);
  const hasDevSession = hasDevSessionConfig();
  const sessionDefaultPath =
    sessionPayload?.defaultPath &&
    sessionPayload.defaultPath.startsWith("/") &&
    sessionPayload.defaultPath !== "/login" &&
    sessionPayload.defaultPath !== "/register"
      ? sessionPayload.defaultPath
      : "/dashboard";

  if (!hasSession && !hasDevSession && !isLoginRoute && !isRegisterRoute) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if ((hasSession || hasDevSession) && pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? sessionDefaultPath : "/dashboard", request.url));
  }

  if (!hasSession && !hasDevSession && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
