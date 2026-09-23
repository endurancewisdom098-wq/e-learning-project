// File: src/app/api/auth/google/callback/route.ts

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=GoogleAuthFailed", request.url));
  }

  try {
    // 1. Exchange authorization code for Google tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri:
          process.env.NEXT_PUBLIC_GOOGLE_CALLBACK_URL ||
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok || !tokens.access_token) {
      throw new Error("Failed to exchange code for tokens with Google.");
    }

    // 2. Fetch user profile info from Google using the access token
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const googleUser = await userResponse.json();

    if (!userResponse.ok || !googleUser.email) {
      throw new Error("Failed to fetch user profile from Google.");
    }

    // 3. TODO: Communicate with your backend database/API
    // Example: send `googleUser.email`, `googleUser.name`, etc., to your backend 
    // to either register a new user or log them in, and receive your app's JWT/session token.

    // 4. Redirect the user to your app's dashboard on success
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    
    // Optional: Set a session cookie if your backend returns one directly here
    // response.cookies.set("token", yourAppToken, { httpOnly: true, secure: true });

    return response;
  } catch (error) {
    console.error("Google Callback Error:", error);
    return NextResponse.redirect(new URL("/auth/login?error=ServerError", request.url));
  }
}