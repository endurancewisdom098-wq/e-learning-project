// File: src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Check Authorization header OR Next.js cookies
    const authHeader = request.headers.get("authorization");
    let token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get("token")?.value || null;
    }

    if (!token) {
      return NextResponse.json(
        { success: false, user: null, message: "No token provided" },
        { status: 401 }
      );
    }

    // 2. Verify JWT token
    const secret = process.env.JWT_SECRET || "fallback_secret_key";
    const decoded = jwt.verify(token, secret) as {
      userId: string | number;
      email: string;
      role: string;
    };

    // 3. Optional: Fetch fresh user data from database to ensure user still exists
    const user = await prisma.users.findUnique({
      where: { id: Number(decoded.userId) },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, user: null, message: "User not found" },
        { status: 404 }
      );
    }

    // 4. Return successful user profile session
    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name || "Student",
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API /auth/me error:", error);
    return NextResponse.json(
      { success: false, user: null, message: "Invalid or expired token" },
      { status: 401 }
    );
  }
}