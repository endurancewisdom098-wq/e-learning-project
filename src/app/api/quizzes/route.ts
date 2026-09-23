 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ----------------------------------------------------------------------
// GET: Fetch Quizzes (Filtered by Lesson, Course, or Instructor)
// Endpoint: /api/quizzes?lessonId=xxx&courseId=yyy&instructorId=zzz
// ----------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const lessonId = searchParams.get("lessonId");
    const courseId = searchParams.get("courseId");
    const instructorId = searchParams.get("instructorId");
    const isPublished = searchParams.get("isPublished");

    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // Build filter criteria
    const whereClause: any = {};

    if (lessonId) {
      whereClause.lessonId = lessonId;
    }

    if (courseId) {
      whereClause.lesson = {
        chapter: { courseId },
      };
    }

    if (instructorId) {
      whereClause.lesson = {
        chapter: {
          course: { instructorId },
        },
      };
    }

    if (isPublished !== null && isPublished !== undefined) {
      whereClause.isPublished = isPublished === "true";
    }

    // Fetch matching quizzes and count
    const [quizzes, totalCount] = await Promise.all([
      prisma.quiz.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              chapter: {
                select: {
                  id: true,
                  title: true,
                  course: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              questions: true,
              attempts: true,
            },
          },
        },
      }),
      prisma.quiz.count({ where: whereClause }),
    ]);

    // Format response payload
    const formattedQuizzes = quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      passingScore: quiz.passingScore,
      isPublished: quiz.isPublished,
      totalQuestions: quiz._count.questions,
      totalAttempts: quiz._count.attempts,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      lesson: quiz.lesson
        ? {
            id: quiz.lesson.id,
            title: quiz.lesson.title,
            chapterTitle: quiz.lesson.chapter.title,
            courseTitle: quiz.lesson.chapter.course.title,
            courseId: quiz.lesson.chapter.course.id,
          }
        : null,
    }));

    return NextResponse.json(
      {
        quizzes: formattedQuizzes,
        meta: {
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GET_QUIZZES_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// POST: Create a New Quiz (with optional nested Questions & Options)
// Endpoint: /api/quizzes
// ----------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      title,
      description,
      lessonId,
      instructorId,
      passingScore = 70,
      isPublished = false,
      questions = [], // Optional array of initial questions
    } = body;

    // 1. Basic field validation
    if (!title || !lessonId) {
      return NextResponse.json(
        { error: "Missing required fields: 'title' and 'lessonId'." },
        { status: 400 }
      );
    }

    // 2. Validate target lesson existence and instructor authorization
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          select: {
            course: {
              select: { instructorId: true },
            },
          },
        },
        quiz: true, // Check if quiz already exists for 1:1 relation
      },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: "Target lesson not found." },
        { status: 404 }
      );
    }

    // Authorization check
    const courseInstructorId = lesson.chapter.course.instructorId;
    if (instructorId && courseInstructorId !== instructorId) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own the course this lesson belongs to." },
        { status: 403 }
      );
    }

    // Check if lesson already has a quiz
    if (lesson.quiz) {
      return NextResponse.json(
        { error: "This lesson already has an associated quiz. Update the existing quiz instead." },
        { status: 409 }
      );
    }

    // 3. Create Quiz (and optionally bulk nested questions + options)
    const newQuiz = await prisma.quiz.create({
      data: {
        title,
        description: description || null,
        lessonId,
        passingScore: parseInt(passingScore.toString(), 10),
        isPublished: Boolean(isPublished),
        ...(questions.length > 0 && {
          questions: {
            create: questions.map((q: any, qIdx: number) => ({
              title: q.title,
              type: q.type || "SINGLE_CHOICE",
              explanation: q.explanation || null,
              position: q.position ?? qIdx + 1,
              options: {
                create: (q.options || []).map((opt: any, optIdx: number) => ({
                  text: opt.text,
                  isCorrect: Boolean(opt.isCorrect),
                  position: opt.position ?? optIdx + 1,
                })),
              },
            })),
          },
        }),
      },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Quiz created successfully.",
        quiz: newQuiz,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_QUIZ_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create quiz.", details: error.message },
      { status: 500 }
    );
  }
}