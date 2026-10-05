import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

function resolveRequestOrigin(request?: Request) {
  const forwardedProto = request?.headers.get("x-forwarded-proto")?.trim();
  const forwardedHost = request?.headers.get("x-forwarded-host")?.trim();
  const host = forwardedHost || request?.headers.get("host")?.trim();

  if (host) {
    const proto = forwardedProto || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function buildLogoutResponse(request?: Request) {
  const requestOrigin = resolveRequestOrigin(request);
  const response = NextResponse.redirect(
    new URL(
      "/login",
      requestOrigin,
    ),
  );
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function POST() {
  return buildLogoutResponse();
}

export async function GET(request: Request) {
  return buildLogoutResponse(request);
}
