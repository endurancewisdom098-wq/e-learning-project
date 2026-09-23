import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      name,
      email,
      password,
      role,
    } = body;

    // Validate required fields
    if (
      !email ||
      !password ||
      !String(email).trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must contain at least 6 characters",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Email is already registered",
        },
        { status: 409 }
      );
    }

    const normalizedRole =
      typeof role === "string"
        ? role.trim().toUpperCase()
        : "USER";

    if (
      normalizedRole !== "USER" &&
      normalizedRole !== "ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid role",
        },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    // Create user
    const user = await prisma.users.create({
      data: {
        name: name?.trim() || null,
        email: normalizedEmail,
        password: passwordHash,
        role: normalizedRole,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      secret,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json(
      {
        success: true,
        message: "Registration successful",
        user,
      },
      { status: 201 }
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error(
      "POST /api/auth/register failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Registration failed",
      },
      { status: 500 }
    );
  }
}