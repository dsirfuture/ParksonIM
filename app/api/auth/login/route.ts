import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Mock login
  const response = NextResponse.json({ success: true });
  response.cookies.set('session', 'mock-session-id', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
