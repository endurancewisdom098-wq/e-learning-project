 import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { sendEnrollmentConfirmationEmail } from "@/lib/email";

// ----------------------------------------------------------------------
// Stripe Initialization
// ----------------------------------------------------------------------

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2024-12-18.acacia" as any, // Standard API version pinning
  typescript: true,
  appInfo: {
    name: "E-Learning Platform Engine",
    version: "1.0.0",
  },
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// ----------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------

export interface CreateCheckoutSessionProps {
  userId: string;
  userEmail: string;
  courseId: string;
}

export interface ProcessRefundProps {
  userId: string;
  courseId: string;
  reason?: string;
}

export interface InstructorOnboardingProps {
  instructorId: string;
  email: string;
}

// ----------------------------------------------------------------------
// 1. Create Course Checkout Session
// ----------------------------------------------------------------------

/**
 * Generates a Stripe Checkout URL for purchasing a course.
 * Creates an initial PENDING purchase record in the database.
 */
export async function createCourseCheckoutSession({
  userId,
  userEmail,
  courseId,
}: CreateCheckoutSessionProps): Promise<{ url: string | null; sessionId: string }> {
  // Fetch target course
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      price: true,
      discountPrice: true,
      isPublished: true,
    },
  });

  if (!course || !course.isPublished) {
    throw new Error("Course not found or is currently unavailable for purchase.");
  }

  // Check if user is already enrolled
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId },
  });

  if (existingEnrollment) {
    throw new Error("Learner is already enrolled in this course.");
  }

  // Determine effective price
  const finalAmount = course.discountPrice !== null ? course.discountPrice : course.price;

  // Handle Free Courses directly without redirecting to Stripe
  if (finalAmount === 0) {
    await enrollUserInCourse({
      userId,
      courseId,
      amountPaid: 0,
      paymentIntentId: "FREE_COURSE",
    });

    return {
      url: `${APP_URL}/courses/${courseId}/learn?enrolled=true`,
      sessionId: "FREE_SESSION",
    };
  }

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: course.title,
            description: `Lifetime access to ${course.title}`,
          },
          unit_amount: Math.round(finalAmount * 100), // Stripe expects amount in cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${APP_URL}/courses/${courseId}/learn?enrolled=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/courses/${courseId}?canceled=true`,
    metadata: {
      userId,
      courseId,
    },
  });

  return {
    url: session.url,
    sessionId: session.id,
  };
}

// ----------------------------------------------------------------------
// 2. Stripe Webhook Verification & Processor
// ----------------------------------------------------------------------

/**
 * Validates and routes incoming raw Stripe Webhook events.
 */
export async function handleStripeWebhook(
  rawBody: string | Buffer,
  signature: string
): Promise<{ success: boolean; eventType?: string }> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    throw new Error(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await processSuccessfulCheckout(session);
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      await processRefundWebhook(charge);
      break;
    }

    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  return { success: true, eventType: event.type };
}

// ----------------------------------------------------------------------
// 3. Database Fulfillment & Enrollment
// ----------------------------------------------------------------------

/**
 * Fulfills order upon successful payment confirmation from Stripe.
 * Executes within a database transaction for idempotency.
 */
async function processSuccessfulCheckout(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const courseId = session.metadata?.courseId;
  const paymentIntentId = session.payment_intent as string;
  const amountPaid = (session.amount_total || 0) / 100;

  if (!userId || !courseId) {
    console.error("Missing metadata in Stripe Checkout session:", session.id);
    return;
  }

  await enrollUserInCourse({
    userId,
    courseId,
    amountPaid,
    paymentIntentId,
  });
}

/**
 * Core internal function to grant access and dispatch receipt.
 */
export async function enrollUserInCourse({
  userId,
  courseId,
  amountPaid,
  paymentIntentId,
}: {
  userId: string;
  courseId: string;
  amountPaid: number;
  paymentIntentId: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, name: true },
  });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, slug: true },
  });

  if (!user || !course) {
    throw new Error("Target user or course not found during enrollment.");
  }

  // Idempotent database write via transaction
  await prisma.$transaction(async (tx) => {
    // 1. Create Enrollment if not existing
    await tx.enrollment.upsert({
      where: {
        userId_courseId: { userId, courseId },
      },
      create: {
        userId,
        courseId,
      },
      update: {},
    });

    // 2. Record Financial Purchase Record
    await tx.purchase.create({
      data: {
        userId,
        courseId,
        amount: amountPaid,
        paymentIntentId,
        status: "COMPLETED",
      },
    });
  });

  // 3. Dispatch confirmation email asynchronously
  const studentName = user.firstName || user.name || "Learner";
  await sendEnrollmentConfirmationEmail({
    email: user.email,
    studentName,
    courseTitle: course.title,
    courseSlug: course.slug || courseId,
    amountPaid,
  });
}

// ----------------------------------------------------------------------
// 4. Refund Processing
// ----------------------------------------------------------------------

/**
 * Issues a Stripe refund and revokes course access.
 */
export async function processRefund({ userId, courseId, reason }: ProcessRefundProps) {
  // Find completed purchase record
  const purchase = await prisma.purchase.findFirst({
    where: {
      userId,
      courseId,
      status: "COMPLETED",
    },
  });

  if (!purchase || !purchase.paymentIntentId) {
    throw new Error("No eligible purchase record found for refund.");
  }

  // Issue Refund via Stripe
  const refund = await stripe.refunds.create({
    payment_intent: purchase.paymentIntentId,
    reason: (reason as Stripe.RefundCreateParams.Reason) || "requested_by_customer",
  });

  // Revoke access and mark purchase as REFUNDED
  await prisma.$transaction([
    prisma.enrollment.deleteMany({
      where: { userId, courseId },
    }),
    prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: "REFUNDED" },
    }),
  ]);

  return { success: true, refundId: refund.id };
}

/**
 * Webhook fallback handler for charge refunds initiated directly in Stripe dashboard.
 */
async function processRefundWebhook(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string;

  if (!paymentIntentId) return;

  const purchase = await prisma.purchase.findFirst({
    where: { paymentIntentId },
  });

  if (purchase) {
    await prisma.$transaction([
      prisma.enrollment.deleteMany({
        where: { userId: purchase.userId, courseId: purchase.courseId },
      }),
      prisma.purchase.update({
        where: { id: purchase.id },
        data: { status: "REFUNDED" },
      }),
    ]);
  }
}

// ----------------------------------------------------------------------
// 5. Stripe Connect for Instructor Payouts
// ----------------------------------------------------------------------

/**
 * Creates an Express Connect Onboarding Account link for Instructors.
 */
export async function createInstructorConnectOnboardingLink({
  instructorId,
  email,
}: InstructorOnboardingProps): Promise<string> {
  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    select: { stripeConnectAccountId: true },
  });

  let stripeAccountId = instructor?.stripeConnectAccountId;

  // Create Express Account if not created yet
  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    stripeAccountId = account.id;

    await prisma.user.update({
      where: { id: instructorId },
      data: { stripeConnectAccountId: stripeAccountId },
    });
  }

  // Generate Account Onboarding Link
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${APP_URL}/instructor/payouts?refresh=true`,
    return_url: `${APP_URL}/instructor/payouts?success=true`,
    type: "account_onboarding",
  });

  return accountLink.url;
}