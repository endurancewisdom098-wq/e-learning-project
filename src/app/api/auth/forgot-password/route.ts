import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { sendPasswordResetOtpEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    await connectDB();
    const email = String((await req.json()).email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Security best practice: Don't reveal if email exists
      return NextResponse.json({ success: true, message: "If account exists, OTP was sent." });
    }

    // Generate 6-Digit OTP & Expiration (15 mins)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = expires;
    await user.save();

    const emailResult = await sendPasswordResetOtpEmail({ email, otp });
    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, message: "Unable to send the reset code." },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: true, message: "OTP sent successfully." });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}