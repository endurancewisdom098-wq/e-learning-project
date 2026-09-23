 import { Resend } from "resend";

// Initialize Resend Client
const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

const FROM_EMAIL = process.env.EMAIL_FROM || "E-Learning Platform <notifications@yourdomain.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ----------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------

export interface SendVerificationEmailProps {
  email: string;
  token: string;
}

export interface SendPasswordResetEmailProps {
  email: string;
  token: string;
}

export interface SendPasswordResetOtpEmailProps {
  email: string;
  otp: string;
}

export interface SendEnrollmentConfirmationProps {
  email: string;
  studentName: string;
  courseTitle: string;
  courseSlug: string;
  amountPaid: number;
}

export interface SendCourseCompletionProps {
  email: string;
  studentName: string;
  courseTitle: string;
  certificateUrl: string;
}

export interface SendAtRiskReengagementProps {
  email: string;
  studentName: string;
  courseTitle: string;
  courseSlug: string;
  progressPercent: number;
}

// ----------------------------------------------------------------------
// Base HTML Template Shell
// ----------------------------------------------------------------------

function renderBaseTemplate(title: string, bodyContent: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
        .logo { font-size: 20px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; display: inline-block; }
        h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
        p { font-size: 15px; line-height: 1.6; color: #94a3b8; margin-top: 0; margin-bottom: 20px; }
        .btn { display: inline-block; background-color: #6366f1; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 10px; margin-bottom: 20px; }
        .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 32px; }
        .badge { background-color: #312e81; color: #a5b4fc; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; display: inline-block; margin-bottom: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">E-Learning Hub</div>
          ${bodyContent}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} E-Learning Platform. All rights reserved.</p>
          <p>If you did not request this email, please ignore it or contact security support.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ----------------------------------------------------------------------
// Transactional Mailers
// ----------------------------------------------------------------------

/**
 * 1. Email Verification / Magic Link
 */
export async function sendVerificationEmail({ email, token }: SendVerificationEmailProps) {
  const confirmUrl = `${APP_URL}/auth/verify-email?token=${token}`;
  const html = renderBaseTemplate(
    "Verify your email address",
    `
      <span class="badge">Account Security</span>
      <h1>Verify your email address</h1>
      <p>Thank you for signing up for our E-Learning platform. Please confirm your email address by clicking the button below.</p>
      <a href="${confirmUrl}" class="btn">Verify Email Address</a>
      <p style="font-size: 13px; color: #64748b;">Or copy and paste this link into your browser:<br/><a href="${confirmUrl}" style="color: #818cf8;">${confirmUrl}</a></p>
    `
  );

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Verify your email address",
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return { success: false, error };
  }
}

/**
 * 2. Password Reset Email
 */
export async function sendPasswordResetEmail({ email, token }: SendPasswordResetEmailProps) {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;
  const html = renderBaseTemplate(
    "Reset your password",
    `
      <span class="badge">Account Recovery</span>
      <h1>Reset your password</h1>
      <p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>
      <a href="${resetUrl}" class="btn">Reset Password</a>
      <p style="font-size: 13px; color: #64748b;">This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this message.</p>
    `
  );

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your password",
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return { success: false, error };
  }
}

/**
 * 3. Course Enrollment Confirmation & Receipt
 */
export async function sendEnrollmentConfirmationEmail({
  email,
  studentName,
  courseTitle,
  courseSlug,
  amountPaid,
}: SendEnrollmentConfirmationProps) {
  const courseUrl = `${APP_URL}/courses/${courseSlug}/learn`;
  const formattedPrice = amountPaid === 0 ? "Free" : `$${amountPaid.toFixed(2)}`;

  const html = renderBaseTemplate(
    `Enrolled: ${courseTitle}`,
    `
      <span class="badge" style="background-color: #064e3b; color: #6ee7b7;">Enrollment Confirmed</span>
      <h1>Welcome to the course, ${studentName}!</h1>
      <p>You have successfully unlocked lifetime access to <strong>${courseTitle}</strong>.</p>
      
      <div style="background-color: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Course:</strong> ${courseTitle}</p>
        <p style="margin: 0; font-size: 13px;"><strong>Amount Charged:</strong> ${formattedPrice}</p>
      </div>

      <a href="${courseUrl}" class="btn">Start Learning Now</a>
    `
  );

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Enrollment Confirmed: ${courseTitle}`,
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send enrollment email:", error);
    return { success: false, error };
  }
}

/**
 * 4. Course Completion & Certificate Delivery
 */
export async function sendCourseCompletionEmail({
  email,
  studentName,
  courseTitle,
  certificateUrl,
}: SendCourseCompletionProps) {
  const html = renderBaseTemplate(
    `Congratulations on completing ${courseTitle}!`,
    `
      <span class="badge" style="background-color: #065f46; color: #a7f3d0;">Course Completed</span>
      <h1>Congratulations, ${studentName}! 🎉</h1>
      <p>You have officially finished <strong>${courseTitle}</strong>. Your dedication and effort have paid off!</p>
      <p>Your verified completion certificate is ready to download and share on LinkedIn or your portfolio.</p>

      <a href="${certificateUrl}" class="btn" style="background-color: #10b981;">View & Download Certificate</a>
    `
  );

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `🎓 Certificate Earned: ${courseTitle}`,
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send course completion email:", error);
    return { success: false, error };
  }
}

/**
 * 5. At-Risk Learner Re-engagement Alert
 */
export async function sendAtRiskReengagementEmail({
  email,
  studentName,
  courseTitle,
  courseSlug,
  progressPercent,
}: SendAtRiskReengagementProps) {
  const resumeUrl = `${APP_URL}/courses/${courseSlug}/learn`;

  const html = renderBaseTemplate(
    `Pick up where you left off in ${courseTitle}`,
    `
      <span class="badge" style="background-color: #7c2d12; color: #fdba74;">Keep Going</span>
      <h1>We miss you, ${studentName}!</h1>
      <p>We noticed you haven't studied in a few days. You're already <strong>${progressPercent}%</strong> through <strong>${courseTitle}</strong>—don't lose your momentum!</p>

      <a href="${resumeUrl}" class="btn" style="background-color: #f97316;">Resume Learning</a>
      <p style="font-size: 13px; color: #64748b;">Just 15 minutes of study today will keep your learning streak alive.</p>
    `
  );

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Don't stop now! You're ${progressPercent}% done with ${courseTitle}`,
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send re-engagement email:", error);
    return { success: false, error };
  }
}

export async function sendPasswordResetOtpEmail({
  email,
  otp,
}: SendPasswordResetOtpEmailProps) {
  const html = renderBaseTemplate(
    "Your password reset code",
    `
      <span class="badge">Account Recovery</span>
      <h1>Password reset code</h1>
      <p>Use the verification code below to reset your password. This code expires in 15 minutes.</p>
      <p style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ffffff; text-align: center;">${otp}</p>
      <p style="font-size: 13px; color: #64748b;">If you did not request this code, you can safely ignore this email.</p>
    `,
  );

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your password reset code",
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send password reset OTP:", error);
    return { success: false, error };
  }
}