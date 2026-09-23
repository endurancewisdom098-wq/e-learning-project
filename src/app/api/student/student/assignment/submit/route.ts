 import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import connectDB from "@/lib/db";
import Assignment from "@/models/Assignment";
import Submission from "@/models/Submission";
import Enrollment from "@/models/Enrollment";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    // 1. Authenticate user from header/session
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    if (!userId || userRole !== "student") {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Student access required." },
        { status: 403 }
      );
    }

    // 2. Extract Form Data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const assignmentId = formData.get("assignmentId") as string;
    const comments = (formData.get("comments") as string) || "";

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, message: "Assignment ID is required." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No submission file attached." },
        { status: 400 }
      );
    }

    // 3. Find Assignment & Verify Course Enrollment
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Assignment not found." },
        { status: 404 }
      );
    }

    const isEnrolled = await Enrollment.findOne({
      courseId: assignment.courseId,
      studentId: userId,
      status: "active",
    });

    if (!isEnrolled) {
      return NextResponse.json(
        {
          success: false,
          message: "You are not enrolled in the course associated with this assignment.",
        },
        { status: 403 }
      );
    }

    // 4. Calculate Deadline Status
    const now = new Date();
    const isLate = assignment.dueDate ? now > new Date(assignment.dueDate) : false;

    // Reject submission if assignment explicitly blocks late submissions
    if (isLate && assignment.allowLateSubmissions === false) {
      return NextResponse.json(
        {
          success: false,
          message: "The deadline for this assignment has passed and late submissions are closed.",
        },
        { status: 400 }
      );
    }

    // 5. Save File to Disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const relativeDirectory = `/uploads/assignments/${assignmentId}/students/${userId}`;
    const targetFolder = path.join(process.cwd(), "public", relativeDirectory);

    await mkdir(targetFolder, { recursive: true });

    const sanitizedFileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const fullPhysicalPath = path.join(targetFolder, sanitizedFileName);

    await writeFile(fullPhysicalPath, buffer);

    const fileUrl = `${relativeDirectory}/${sanitizedFileName}`;

    // 6. Upsert Submission Record (Update if student resubmits, or create new)
    const submissionRecord = await Submission.findOneAndUpdate(
      { assignmentId, studentId: userId },
      {
        assignmentId,
        studentId: userId,
        courseId: assignment.courseId,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        comments,
        submittedAt: now,
        status: isLate ? "submitted_late" : "submitted",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json(
      {
        success: true,
        message: isLate
          ? "Assignment submitted (Marked as Late)."
          : "Assignment submitted successfully!",
        data: submissionRecord,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Student Submission Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit assignment." },
      { status: 500 }
    );
  }
}