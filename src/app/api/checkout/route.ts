import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCourseCheckoutSession } from "@/lib/payment";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const courseId = (await request.json()).courseId as string | undefined;

    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    const checkout = await createCourseCheckoutSession({
      userId: session.user.id,
      userEmail: session.user.email,
      courseId,
    });

    return NextResponse.json(checkout);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout initialization failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}