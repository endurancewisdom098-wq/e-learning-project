 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ----------------------------------------------------------------------
// Interfaces
// ----------------------------------------------------------------------

interface CreateAssignmentInput {
  title: string;
  description?: string;
  courseId: string;
  dueDate: string; // ISO String
  maxScore?: number;
  instructorId: string; // Passed from request body or session
}

// ----------------------------------------------------------------------
// GET: Fetch Assignments for a Course or Student
// Endpoint: /api/assignments?courseId=xxx&studentId=yyy
// ----------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const studentId = searchParams.get("studentId");

    if (!courseId) {
      return NextResponse.json(
        { error: "Query parameter 'courseId' is required." },
        { status: 400 }
      );
    }

    // 1. Fetch all assignments for the given course
    const assignments = await prisma.assignment.findMany({
      where: { courseId },
      orderBy: { dueDate: "asc" },
      include: {
        submissions: studentId
          ? {
              where: { studentId },
              select: {
                id: true,
                submissionUrl: true,
                score: true,
                feedback: true,
                status: true,
                submittedAt: true,
              },
            }
          : false,
      },
    });

    // 2. Format output with student submission status if studentId was provided
    const formattedAssignments = assignments.map((assignment) => {
      const studentSubmission = studentId ? assignment.submissions?.[0] : null;

      return {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        dueDate: assignment.dueDate,
        maxScore: assignment.maxScore,
        createdAt: assignment.createdAt,
        submission: studentSubmission || null,
        isSubmitted: !!studentSubmission,
      };
    });

    return NextResponse.json({ assignments: formattedAssignments }, { status: 200 });
  } catch (error: any) {
    console.error("[GET_ASSIGNMENTS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// POST: Create a New Assignment (Instructor Only)
// Endpoint: /api/assignments
// ----------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body: CreateAssignmentInput = await req.json();

    const { title, description, courseId, dueDate, maxScore, instructorId } = body;

    // 1. Validation
    if (!title || !courseId || !dueDate || !instructorId) {
      return NextResponse.json(
        { error: "Missing required fields: title, courseId, dueDate, instructorId." },
        { status: 400 }
      );
    }

    // 2. Verify course exists and belongs to the instructor
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found." },
        { status: 404 }
      );
    }

    if (course.instructorId !== instructorId) {
      return NextResponse.json(
        { error: "Unauthorized: You are not the instructor of this course." },
        { status: 403 }
      );
    }

    // 3. Create the assignment in Database
    const newAssignment = await prisma.assignment.create({
      data: {
        title,
        description: description || "",
        courseId,
        dueDate: new Date(dueDate),
        maxScore: maxScore ?? 100,
      },
    });

    return NextResponse.json(
      { message: "Assignment created successfully.", assignment: newAssignment },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_ASSIGNMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create assignment.", details: error.message },
      { status: 500 }
    );
  }
}