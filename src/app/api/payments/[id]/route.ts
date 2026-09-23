 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Allowed payment status states
const VALID_PAYMENT_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"];

// ----------------------------------------------------------------------
// GET: Fetch Single Payment/Transaction Details
// Endpoint: /api/payment/[id]?userId=xxx
// Supports fetching by Payment ID or Stripe Payment Intent ID
// ----------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // Search by Database Payment ID or Stripe PaymentIntent ID
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id: id }, { stripePaymentIntentId: id }],
      },
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
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment transaction record not found." },
        { status: 404 }
      );
    }

    // Authorization check: Must be the buyer, course instructor, or an admin
    const isPayer = payment.userId === userId;
    const isInstructor = payment.course.instructor.id === userId;

    if (userId && !isPayer && !isInstructor) {
      return NextResponse.json(
        { error: "Unauthorized access to payment record." },
        { status: 403 }
      );
    }

    // Format transaction response
    const formattedPayment = {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency || "USD",
      status: payment.status,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      receiptUrl: payment.receiptUrl || null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      student: payment.user,
      course: {
        id: payment.course.id,
        title: payment.course.title,
        slug: payment.course.slug,
        imageUrl: payment.course.imageUrl,
        price: payment.course.price,
        instructorName: `${payment.course.instructor.firstName} ${payment.course.instructor.lastName}`,
      },
    };

    return NextResponse.json({ payment: formattedPayment }, { status: 200 });
  } catch (error: any) {
    console.error("[GET_PAYMENT_BY_ID_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch payment details.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// PATCH: Update Payment Status (Refunds, Manual Completion, Admin Overrides)
// Endpoint: /api/payment/[id]
// ----------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { status, receiptUrl, adminId, refundReason } = body;

    if (!adminId) {
      return NextResponse.json(
        { error: "Admin or Instructor ID is required for validation." },
        { status: 400 }
      );
    }

    // 1. Verify existence
    const existingPayment = await prisma.payment.findUnique({
      where: { id },
      include: {
        course: { select: { instructorId: true } },
      },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { error: "Payment record not found." },
        { status: 404 }
      );
    }

    // 2. Validate status if provided
    if (status && !VALID_PAYMENT_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Allowed values: ${VALID_PAYMENT_STATUSES.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    // 3. Handle status change side-effects (e.g. Refund cancels enrollment)
    if (status === "REFUNDED" && existingPayment.status !== "REFUNDED") {
      await prisma.$transaction([
        // Update payment record
        prisma.payment.update({
          where: { id },
          data: {
            status: "REFUNDED",
            ...(receiptUrl && { receiptUrl }),
          },
        }),
        // Revoke student enrollment for this course
        prisma.enrollment.updateMany({
          where: {
            userId: existingPayment.userId,
            courseId: existingPayment.courseId,
          },
          data: {
            status: "CANCELLED",
          },
        }),
      ]);

      return NextResponse.json(
        {
          message:
            "Payment status updated to REFUNDED and student enrollment revoked.",
          paymentId: id,
          refundReason: refundReason || "No reason specified.",
        },
        { status: 200 }
      );
    }

    // Standard record update
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(receiptUrl !== undefined && { receiptUrl }),
      },
    });

    return NextResponse.json(
      {
        message: "Payment record updated successfully.",
        payment: updatedPayment,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[UPDATE_PAYMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update payment record.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// DELETE: Remove Payment Record (Admin Only)
// Endpoint: /api/payment/[id]?adminId=xxx
// ----------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get("adminId");

    if (!adminId) {
      return NextResponse.json(
        { error: "Query parameter 'adminId' is required for deletion." },
        { status: 400 }
      );
    }

    // 1. Check if payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { error: "Payment record not found." },
        { status: 404 }
      );
    }

    // 2. Delete Payment Record
    await prisma.payment.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Payment record deleted successfully." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[DELETE_PAYMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete payment record.", details: error.message },
      { status: 500 }
    );
  }
}