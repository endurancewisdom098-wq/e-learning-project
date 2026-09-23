// File: src/services/auth.service.ts
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword, signJwtToken } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterDTO {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
}

export async function registerUserService(body: RegisterDTO) {
  const { email, password, name, role } = body;

  // 1. Input Validation
  if (!email || !password) {
    const error: any = new Error("Email and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    const error: any = new Error("Please enter a valid email address.");
    error.statusCode = 400;
    throw error;
  }

  if (password.length < 6) {
    const error: any = new Error("Password must be at least 6 characters long.");
    error.statusCode = 400;
    throw error;
  }

  // 2. Check Existing User
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const error: any = new Error("An account with this email address already exists.");
    error.statusCode = 409;
    throw error;
  }

  // 3. Hash Password
  const hashedPassword = await hashPassword(password);

  // 4. Create User in Database
  const userRole = role || "STUDENT";
  const displayName = name ? String(name).trim() : null;

  const newUser = await db.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      name: displayName,
      role: userRole,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  // 5. Generate Signed JWT Token via Auth Utility
  const token = await signJwtToken({
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
  });

  // 6. Set HTTP-Only Cookie
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  // 7. Return Response Payload
  return {
    message: "Registration successful!",
    token,
    user: newUser,
  };
}