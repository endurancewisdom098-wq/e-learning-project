 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ----------------------------------------------------------------------
// GET: Fetch a Single Assignment Details
// Endpoint: /api/assignments/[id]?studentId=xxx
// ----------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, title: true, instructorId: true },
        },
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
          : {
              select: {
                id: true,
                studentId: true,
                submissionUrl: true,
                score: true,
                status: true,
                submittedAt: true,
              },
            },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ assignment }, { status: 200 });
  } catch (error: any) {
    console.error("[GET_ASSIGNMENT_BY_ID_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch assignment.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// PATCH: Update Assignment Details (Instructor Only)
// Endpoint: /api/assignments/[id]
// ----------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { title, description, dueDate, maxScore, instructorId } = body;

    if (!instructorId) {
      return NextResponse.json(
        { error: "Instructor ID is required for validation." },
        { status: 400 }
      );
    }

    // 1. Verify assignment existence and instructor ownership
    const existingAssignment = await prisma.assignment.findUnique({
      where: { id },
      include: { course: { select: { instructorId: true } } },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: "Assignment not found." },
        { status: 404 }
      );
    }

    if (existingAssignment.course.instructorId !== instructorId) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own this course." },
        { status: 403 }
      );
    }

    // 2. Perform Update
    const updatedAssignment = await prisma.assignment.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(maxScore !== undefined && { maxScore }),
      },
    });

    return NextResponse.json(
      { message: "Assignment updated successfully.", assignment: updatedAssignment },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[UPDATE_ASSIGNMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update assignment.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// DELETE: Remove Assignment (Instructor Only)
// Endpoint: /api/assignments/[id]
// ----------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const instructorId = searchParams.get("instructorId");

    if (!instructorId) {
      return NextResponse.json(
        { error: "Query parameter 'instructorId' is required." },
        { status: 400 }
      );
    }

    // 1. Check ownership before deletion
    const existingAssignment = await prisma.assignment.findUnique({
      where: { id },
      include: { course: { select: { instructorId: true } } },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: "Assignment not found." },
        { status: 404 }
      );
    }

    if (existingAssignment.course.instructorId !== instructorId) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own this course." },
        { status: 403 }
      );
    }

    // 2. Delete Assignment (Submissions will cascade delete if configured in Prisma schema)
    await prisma.assignment.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Assignment deleted successfully." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[DELETE_ASSIGNMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete assignment.", details: error.message },
      { status: 500 }
    );
  }
}