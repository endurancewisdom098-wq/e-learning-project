import { cookies } from "next/headers";
import { verifyJwtToken } from "@/lib/auth";

export type UserRole = "ADMIN" | "INSTRUCTOR" | "STUDENT";

export async function auth() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return null;
    }

    const payload = await verifyJwtToken(token);

    if (!payload || typeof payload !== "object") {
      return null;
    }

    const role = (payload.role as string | undefined)?.toUpperCase() || "STUDENT";

    return {
      user: {
        id: String(payload.userId || payload.sub || payload.email || "guest"),
        email: String(payload.email || ""),
        role: (role === "ADMIN" || role === "INSTRUCTOR" || role === "STUDENT") ? role : "STUDENT",
      },
    };
  } catch {
    return null;
  }
}
