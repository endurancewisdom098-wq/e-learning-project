 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper function to sanitize correct answers for non-instructor users
function sanitizeQuizForStudent(quiz: any) {
  return {
    ...quiz,
    questions: quiz.questions.map((question: any) => ({
      id: question.id,
      title: question.title,
      type: question.type, // e.g., 'SINGLE_CHOICE', 'MULTIPLE_CHOICE'
      explanation: null,   // Hide answer explanations until submission
      options: question.options.map((option: any) => ({
        id: option.id,
        text: option.text,
        // Omit option.isCorrect to prevent client-side inspection/cheating
      })),
    })),
  };
}

// ----------------------------------------------------------------------
// GET: Fetch Single Quiz (with Questions, Options, & Student Attempt History)
// Endpoint: /api/quizzes/[id]?userId=xxx&isInstructor=false
// ----------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");
    const isInstructor = searchParams.get("isInstructor") === "true";

    // 1. Fetch Quiz by ID or associated Lesson ID
    const quiz = await prisma.quiz.findFirst({
      where: {
        OR: [{ id: id }, { lessonId: id }],
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            chapter: {
              select: {
                id: true,
                courseId: true,
                course: {
                  select: { instructorId: true },
                },
              },
            },
          },
        },
        questions: {
          orderBy: { position: "asc" },
          include: {
            options: {
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json(
        { error: "Quiz not found." },
        { status: 404 }
      );
    }

    // 2. Fetch user's previous quiz attempts if userId is provided
    let userAttempts: any[] = [];
    let bestAttempt: any = null;

    if (userId) {
      userAttempts = await prisma.quizAttempt.findMany({
        where: {
          quizId: quiz.id,
          userId,
        },
        orderBy: { score: "desc" },
        select: {
          id: true,
          score: true,
          isPassed: true,
          completedAt: true,
        },
      });

      if (userAttempts.length > 0) {
        bestAttempt = userAttempts[0] as any;
      }
    }

    // 3. Authorization check to disclose full correct answers
    const courseInstructorId = quiz.lesson?.chapter?.course?.instructorId;
    const canSeeAnswers = isInstructor && userId === courseInstructorId;

    // Sanitize question options for students to prevent cheating
    const finalQuizData = canSeeAnswers ? quiz : sanitizeQuizForStudent(quiz);

    return NextResponse.json(
      {
        quiz: finalQuizData,
        attempts: userAttempts,
        bestAttempt,
        isPassed: bestAttempt ? bestAttempt.isPassed : false,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GET_QUIZ_BY_ID_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch quiz details.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// PATCH: Update Quiz Details or Passing Criteria (Instructor Only)
// Endpoint: /api/quizzes/[id]
// ----------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const {
      title,
      description,
      passingScore,
      isPublished,
      instructorId,
    } = body;

    if (!instructorId) {
      return NextResponse.json(
        { error: "Instructor ID is required for authorization." },
        { status: 400 }
      );
    }

    // 1. Verify Quiz existence and instructor ownership
    const existingQuiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        lesson: {
          select: {
            chapter: {
              select: {
                course: { select: { instructorId: true } },
              },
            },
          },
        },
      },
    });

    if (!existingQuiz) {
      return NextResponse.json(
        { error: "Quiz not found." },
        { status: 404 }
      );
    }

    const courseInstructor = existingQuiz.lesson?.chapter?.course?.instructorId;
    if (courseInstructor && courseInstructor !== instructorId) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own the course this quiz belongs to." },
        { status: 403 }
      );
    }

    // 2. Perform update
    const updatedQuiz = await prisma.quiz.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(passingScore !== undefined && { passingScore: parseInt(passingScore.toString(), 10) }),
        ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
      },
    });

    return NextResponse.json(
      {
        message: "Quiz updated successfully.",
        quiz: updatedQuiz,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[UPDATE_QUIZ_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update quiz.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// DELETE: Remove Quiz Record and Associated Questions (Instructor Only)
// Endpoint: /api/quizzes/[id]?instructorId=xxx
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

    // 1. Check existence and instructor ownership
    const existingQuiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        lesson: {
          select: {
            chapter: {
              select: {
                course: { select: { instructorId: true } },
              },
            },
          },
        },
      },
    });

    if (!existingQuiz) {
      return NextResponse.json(
        { error: "Quiz not found." },
        { status: 404 }
      );
    }

    const courseInstructor = existingQuiz.lesson?.chapter?.course?.instructorId;
    if (courseInstructor && courseInstructor !== instructorId) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own the course this quiz belongs to." },
        { status: 403 }
      );
    }

    // 2. Delete quiz (Prisma handles cascading deletion for questions, options, and attempts if configured)
    await prisma.quiz.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Quiz deleted successfully." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[DELETE_QUIZ_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete quiz.", details: error.message },
      { status: 500 }
    );
  }
}