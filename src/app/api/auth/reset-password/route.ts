// File: src/app/api/auth/reset-password/route.ts

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

const PASSWORD_MIN_LENGTH = 6;

// Handle CORS preflight checks
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp, token, newPassword } = body;
    const resetCode = String(otp || token || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // 1. Validate input presence
    if (!normalizedEmail || !resetCode || !newPassword) {
      return NextResponse.json(
        { message: "Email, OTP, and new password are required.", error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 2. Validate password strength
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        {
          message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
          error: "Weak password",
        },
        { status: 400 }
      );
    }

    // 3. Find user with valid token and unexpired reset window
    await connectDB();
    const user = await User.findOne({
      email: normalizedEmail,
      resetPasswordOtp: resetCode,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Invalid or expired reset token.", error: "Invalid token" },
        { status: 400 }
      );
    }

    // 4. Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 5. Update user password and clear reset token fields
    user.password = hashedPassword;
    user.resetPasswordOtp = null;
    user.resetPasswordExpires = null;
    await user.save();

    return NextResponse.json(
      { message: "Password updated successfully!" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[RESET_PASSWORD_ERROR]", error?.message || error);
    return NextResponse.json(
      { message: "An unexpected error occurred during password reset.", error: "Internal server error" },
      { status: 500 }
    );
  }
}