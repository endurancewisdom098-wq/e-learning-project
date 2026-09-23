 import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const otp = String(body.otp || "").trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, message: "A valid email and 6-digit OTP are required." },
        { status: 400 },
      );
    }

    const user = await User.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: new Date() }, // Check if not expired
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired OTP code." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "OTP verified successfully." });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}