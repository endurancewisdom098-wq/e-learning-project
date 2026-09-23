 "use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import Session from "@/models/Session";

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (token) {
    try {
      await connectDB();
      await Session.deleteOne({ token });
    } catch (error) {
      console.error("Database session revocation failed:", error);
    }
  }

  // Clear cookie
  cookieStore.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });

  redirect("/login");
}