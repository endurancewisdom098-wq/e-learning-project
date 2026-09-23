 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Allowed payment statuses
const VALID_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"];

// ----------------------------------------------------------------------
// GET: Fetch Payment & Transaction History
// Endpoint: /api/payment?userId=xxx&courseId=yyy&instructorId=zzz&status=COMPLETED
// ----------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");
    const courseId = searchParams.get("courseId");
    const instructorId = searchParams.get("instructorId");
    const status = searchParams.get("status");

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // Build Prisma filter clause
    const whereClause: any = {};

    if (userId) {
      whereClause.userId = userId;
    }

    if (courseId) {
      whereClause.courseId = courseId;
    }

    if (instructorId) {
      whereClause.course = {
        instructorId: instructorId,
      };
    }

    if (status) {
      if (!VALID_STATUSES.includes(status.toUpperCase())) {
        return NextResponse.json(
          { error: `Invalid status parameter. Allowed values: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      whereClause.status = status.toUpperCase();
    }

    // Execute paginated search & count total matching records
    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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
                },
              },
            },
          },
        },
      }),
      prisma.payment.count({ where: whereClause }),
    ]);

    // Compute revenue stats if requested for an instructor or course
    let totalRevenue = 0;
    if (instructorId || courseId) {
      const revenueAggregation = await prisma.payment.aggregate({
        where: {
          ...whereClause,
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
      });
      totalRevenue = revenueAggregation._sum.amount || 0;
    }

    return NextResponse.json(
      {
        payments,
        meta: {
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          ...( (instructorId || courseId) && { totalRevenue }),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GET_PAYMENTS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch payment records.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// POST: Record New Payment & Activate Course Enrollment
// Endpoint: /api/payment
// ----------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      userId,
      courseId,
      amount,
      currency = "USD",
      stripePaymentIntentId,
      receiptUrl,
      status = "COMPLETED",
    } = body;

    // 1. Basic field validation
    if (!userId || !courseId || amount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: userId, courseId, amount." },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // 2. Validate user existence
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    // 3. Validate course existence
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, price: true, isPublished: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found." },
        { status: 404 }
      );
    }

    // 4. Prevent duplicate active enrollments
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment && existingEnrollment.status === "ACTIVE") {
      return NextResponse.json(
        { error: "User is already enrolled in this course." },
        { status: 409 }
      );
    }

    // 5. Execute transaction: Create payment record + Enroll user (if payment completed)
    const normalizedStatus = status.toUpperCase();

    const result = await prisma.$transaction(async (tx) => {
      // Create Payment entry
      const payment = await tx.payment.create({
        data: {
          userId,
          courseId,
          amount: parseFloat(amount),
          currency: currency.toUpperCase(),
          status: normalizedStatus,
          stripePaymentIntentId: stripePaymentIntentId || null,
          receiptUrl: receiptUrl || null,
        },
      });

      // If status is COMPLETED, create or reactivate course enrollment
      let enrollment = null;
      if (normalizedStatus === "COMPLETED") {
        enrollment = await tx.enrollment.upsert({
          where: {
            userId_courseId: {
              userId,
              courseId,
            },
          },
          update: {
            status: "ACTIVE",
            updatedAt: new Date(),
          },
          create: {
            userId,
            courseId,
            status: "ACTIVE",
          },
        });
      }

      return { payment, enrollment };
    });

    return NextResponse.json(
      {
        message:
          normalizedStatus === "COMPLETED"
            ? "Payment recorded and student enrolled successfully."
            : "Payment record created.",
        payment: result.payment,
        enrollment: result.enrollment,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_PAYMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create payment record.", details: error.message },
      { status: 500 }
    );
  }
}