// File: src/app/api/auth/google/route.ts

import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  // Resolves explicit callback URL or constructs from app root URL
  const redirectUri =
    process.env.NEXT_PUBLIC_GOOGLE_CALLBACK_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;

  // 1. Guard check for missing environment variable
  if (!clientId) {
    console.error("[GOOGLE_OAUTH_ERROR] GOOGLE_CLIENT_ID is missing in environment variables.");
    return NextResponse.json(
      { error: "Google Client ID is not configured in environment variables." },
      { status: 500 }
    );
  }

  try {
    // 2. Build Google OAuth 2.0 authorization URL
    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "consent");

    // 3. Issue server-side redirect to Google
    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error("[GOOGLE_OAUTH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate Google OAuth redirect URL." },
      { status: 500 }
    );
  }
}