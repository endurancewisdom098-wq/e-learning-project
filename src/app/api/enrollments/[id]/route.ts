 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ----------------------------------------------------------------------
// GET: Fetch Single Enrollment Details with Progress & Course Summary
// Endpoint: /api/enrollments/[id]?userId=xxx
// ----------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            price: true,
            instructor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
            chapters: {
              where: { isPublished: true },
              select: {
                id: true,
                title: true,
                lessons: {
                  where: { isPublished: true },
                  select: { id: true, title: true, duration: true },
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment record not found." },
        { status: 404 }
      );
    }

    // Authorization check: User must be the student or course instructor
    if (
      userId &&
      enrollment.userId !== userId &&
      enrollment.course.instructor.id !== userId
    ) {
      return NextResponse.json(
        { error: "Unauthorized access to enrollment record." },
        { status: 403 }
      );
    }

    // Calculate course progress stats
    const totalLessons = enrollment.course.chapters.reduce(
      (acc, chapter) => acc + chapter.lessons.length,
      0
    );

    const completedLessons = await prisma.userProgress.count({
      where: {
        userId: enrollment.userId,
        isCompleted: true,
        lesson: {
          chapter: {
            courseId: enrollment.course.id,
          },
        },
      },
    });

    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return NextResponse.json(
      {
        enrollment: {
          ...enrollment,
          progress: {
            completedLessons,
            totalLessons,
            percentage: progressPercentage,
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GET_ENROLLMENT_BY_ID_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch enrollment details.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// PATCH: Update Enrollment Status (e.g. ACTIVE, COMPLETED, CANCELLED)
// Endpoint: /api/enrollments/[id]
// ----------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { status, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required for authorization validation." },
        { status: 400 }
      );
    }

    // 1. Verify existence and authorization
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        course: { select: { instructorId: true } },
      },
    });

    if (!existingEnrollment) {
      return NextResponse.json(
        { error: "Enrollment not found." },
        { status: 404 }
      );
    }

    const isStudent = existingEnrollment.userId === userId;
    const isInstructor = existingEnrollment.course.instructorId === userId;

    if (!isStudent && !isInstructor) {
      return NextResponse.json(
        { error: "Unauthorized to modify this enrollment." },
        { status: 403 }
      );
    }

    // Valid status values
    const allowedStatuses = ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"];
    if (status && !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // 2. Perform Update
    const updatedEnrollment = await prisma.enrollment.update({
      where: { id },
      data: {
        ...(status && { status }),
      },
      include: {
        course: { select: { id: true, title: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return NextResponse.json(
      {
        message: "Enrollment status updated successfully.",
        enrollment: updatedEnrollment,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[UPDATE_ENROLLMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update enrollment.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// DELETE: Drop/Un-enroll Student from a Course
// Endpoint: /api/enrollments/[id]?userId=xxx
// ----------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Query parameter 'userId' is required." },
        { status: 400 }
      );
    }

    // 1. Check enrollment existence and authorization
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, instructorId: true } },
      },
    });

    if (!existingEnrollment) {
      return NextResponse.json(
        { error: "Enrollment not found." },
        { status: 404 }
      );
    }

    const isStudent = existingEnrollment.userId === userId;
    const isInstructor = existingEnrollment.course.instructorId === userId;

    if (!isStudent && !isInstructor) {
      return NextResponse.json(
        { error: "Unauthorized: You cannot remove this enrollment." },
        { status: 403 }
      );
    }

    // 2. Delete enrollment record (and optionally clean progress)
    await prisma.$transaction([
      prisma.enrollment.delete({
        where: { id },
      }),
      // Remove student progress for this course
      prisma.userProgress.deleteMany({
        where: {
          userId: existingEnrollment.userId,
          lesson: {
            chapter: {
              courseId: existingEnrollment.course.id,
            },
          },
        },
      }),
    ]);

    return NextResponse.json(
      { message: "Enrollment and associated progress removed successfully." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[DELETE_ENROLLMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete enrollment.", details: error.message },
      { status: 500 }
    );
  }
}