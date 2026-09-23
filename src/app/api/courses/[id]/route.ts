import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRolePermission, UserRole } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ----------------------------------------------------------------------
// PATCH: Update Course Details or Publish State
// ----------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // 1. Get authenticated user ID & Role directly from Clerk session
    const session = await auth();
    const userId = session?.user.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: Please sign in." },
        { status: 401 }
      );
    }

    // Role configured in Clerk Public Metadata
    const userRole = session?.user.role as UserRole;

    // 2. Permission Check
    if (!hasRolePermission(userRole, "course:edit")) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to edit courses." },
        { status: 403 }
      );
    }

    // 3. Fetch Existing Course & Ownership Check
    const existingCourse = await prisma.course.findUnique({
      where: { id },
      include: { chapters: { include: { lessons: true } } },
    });

    if (!existingCourse) {
      return NextResponse.json(
        { error: "Course not found." },
        { status: 404 }
      );
    }

    const isOwner = existingCourse.instructorId === userId;
    const isAdmin = userRole === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own this course." },
        { status: 403 }
      );
    }

    // 4. Update Course Record
    const body = await req.json();
    const updatedCourse = await prisma.course.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: parseFloat(body.price.toString()) }),
        ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      },
    });

    return NextResponse.json({ course: updatedCourse }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update course.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// DELETE: Delete Course
// ----------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 1. Get session from Clerk
    const session = await auth();
    const userId = session?.user.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: Please sign in." },
        { status: 401 }
      );
    }

    const userRole = session?.user.role as UserRole;

    if (!hasRolePermission(userRole, "course:delete")) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to delete courses." },
        { status: 403 }
      );
    }

    const existingCourse = await prisma.course.findUnique({
      where: { id },
      select: { instructorId: true },
    });

    if (!existingCourse) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const isOwner = existingCourse.instructorId === userId;
    const isAdmin = userRole === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own this course." },
        { status: 403 }
      );
    }

    await prisma.course.delete({ where: { id } });

    return NextResponse.json({ message: "Course deleted successfully." }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete course.", details: error.message },
      { status: 500 }
    );
  }
}