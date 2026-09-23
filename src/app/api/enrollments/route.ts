 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ----------------------------------------------------------------------
// GET: Fetch Enrollments (For Student Dashboard or Instructor Roster)
// Endpoint: /api/enrollments?userId=xxx&role=STUDENT&status=ACTIVE&page=1&limit=10
// ----------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");
    const courseId = searchParams.get("courseId");
    const status = searchParams.get("status"); // ACTIVE | COMPLETED | CANCELLED
    const role = searchParams.get("role") || "STUDENT"; // STUDENT | INSTRUCTOR

    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // Build filter query
    const whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (courseId) {
      whereClause.courseId = courseId;
    }

    // Role-based filtering
    if (userId) {
      if (role === "INSTRUCTOR") {
        // Show enrollments across courses taught by this instructor
        whereClause.course = { instructorId: userId };
      } else {
        // Default: Show enrollments for this student
        whereClause.userId = userId;
      }
    }

    // Query Database
    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
                  lessons: {
                    where: { isPublished: true },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.enrollment.count({ where: whereClause }),
    ]);

    // Calculate progress for each enrollment item
    const formattedEnrollments = await Promise.all(
      enrollments.map(async (item) => {
        const totalLessons = item.course.chapters.reduce(
          (acc, ch) => acc + ch.lessons.length,
          0
        );

        const completedLessons = await prisma.userProgress.count({
          where: {
            userId: item.userId,
            isCompleted: true,
            lesson: {
              chapter: {
                courseId: item.course.id,
              },
            },
          },
        });

        const progressPercentage =
          totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;

        return {
          id: item.id,
          status: item.status,
          createdAt: item.createdAt,
          student: item.user,
          course: {
            id: item.course.id,
            title: item.course.title,
            slug: item.course.slug,
            imageUrl: item.course.imageUrl,
            price: item.course.price,
            instructor: item.course.instructor,
          },
          progress: {
            completedLessons,
            totalLessons,
            percentage: progressPercentage,
          },
        };
      })
    );

    return NextResponse.json(
      {
        enrollments: formattedEnrollments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GET_ENROLLMENTS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch enrollments.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// POST: Create a New Course Enrollment
// Endpoint: /api/enrollments
// ----------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { userId, courseId, paymentIntentId } = body;

    // 1. Validation
    if (!userId || !courseId) {
      return NextResponse.json(
        { error: "Missing required fields: userId and courseId." },
        { status: 400 }
      );
    }

    // 2. Check if Course exists and is published
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, price: true, isPublished: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found." },
        { status: 404 }
      );
    }

    if (!course.isPublished) {
      return NextResponse.json(
        { error: "Cannot enroll in an unpublished course." },
        { status: 400 }
      );
    }

    // 3. Check if Student exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User record not found." },
        { status: 404 }
      );
    }

    // 4. Prevent duplicate enrollment
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      return NextResponse.json(
        {
          error: "User is already enrolled in this course.",
          enrollment: existingEnrollment,
        },
        { status: 409 }
      );
    }

    // 5. Check if course is paid and payment was completed (if price > 0)
    if (course.price > 0 && !paymentIntentId) {
      // Return warning/prompt if attempting to directly enroll in a paid course without payment proof
      return NextResponse.json(
        {
          error:
            "Payment proof required. This is a paid course and requires payment completion before enrollment.",
        },
        { status: 402 }
      );
    }

    // 6. Create Enrollment Record
    const newEnrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId,
        status: "ACTIVE",
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Successfully enrolled in the course.",
        enrollment: newEnrollment,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_ENROLLMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process enrollment.", details: error.message },
      { status: 500 }
    );
  }
}