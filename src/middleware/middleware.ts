// File: src/middleware.ts (or root middleware.ts)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Let API auth routes pass through unhindered
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }
  
  // ... rest of your middleware protection logic ...
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};

// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except for the ones starting with:
//      * - api/auth (API authentication routes)
//      * - _next/static (static files)
//      * - _next/image (image optimization files)
//      * - favicon.ico (favicon file)
//      */
//     "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
//   ],
// };