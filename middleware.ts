import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Stripe webhook エンドポイントは認証をスキップ
  if (request.nextUrl.pathname.startsWith('/api/webhook/stripe')) {
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/webhook/:path*'],
};