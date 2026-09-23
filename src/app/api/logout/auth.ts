 import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Session from "@/models/Session";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    // Optional: Revoke active session token in MongoDB/Database
    if (token) {
      await connectDB();
      await Session.deleteOne({ token });
    }

    // Expire the HTTP-only session cookie across the whole domain
    cookieStore.set("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(0),
      path: "/",
    });

    return NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Logout API Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to logout user" },
      { status: 500 }
    );
  }
}