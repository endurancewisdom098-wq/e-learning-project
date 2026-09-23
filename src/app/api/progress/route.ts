 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ----------------------------------------------------------------------
// GET: Fetch User Progress for a Course or Specific Lesson
// Endpoint: /api/progress?userId=xxx&courseId=yyy OR /api/progress?userId=xxx&lessonId=zzz
// ----------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");
    const courseId = searchParams.get("courseId");
    const lessonId = searchParams.get("lessonId");

    if (!userId) {
      return NextResponse.json(
        { error: "Query parameter 'userId' is required." },
        { status: 400 }
      );
    }

    if (!courseId && !lessonId) {
      return NextResponse.json(
        { error: "At least one query parameter ('courseId' or 'lessonId') is required." },
        { status: 400 }
      );
    }

    // 1. Single Lesson Progress Lookup
    if (lessonId) {
      const progress = await prisma.userProgress.findUnique({
        where: {
          userId_lessonId: {
            userId,
            lessonId,
          },
        },
      });

      return NextResponse.json(
        {
          progress: progress || {
            userId,
            lessonId,
            isCompleted: false,
            updatedAt: null,
          },
        },
        { status: 200 }
      );
    }

    // 2. Full Course Progress Summary Lookup
    if (courseId) {
      // Get all published lessons in the course
      const courseLessons = await prisma.lesson.findMany({
        where: {
          chapter: { courseId },
          isPublished: true,
        },
        select: { id: true },
      });

      const totalLessons = courseLessons.length;
      const lessonIds = courseLessons.map((l) => l.id);

      // Get user's completed progress entries for this course
      const completedProgress = await prisma.userProgress.findMany({
        where: {
          userId,
          lessonId: { in: lessonIds },
          isCompleted: true,
        },
        select: { lessonId: true, updatedAt: true },
      });

      const completedCount = completedProgress.length;
      const progressPercentage =
        totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      return NextResponse.json(
        {
          courseId,
          userId,
          progressPercentage,
          completedCount,
          totalLessons,
          completedLessonIds: completedProgress.map((p) => p.lessonId),
          isCourseCompleted: totalLessons > 0 && completedCount === totalLessons,
        },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error("[GET_PROGRESS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch user progress.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// PUT / POST: Update or Toggle Lesson Progress Status
// Endpoint: /api/progress
// ----------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const { userId, lessonId, isCompleted = true } = body;

    // 1. Basic validation
    if (!userId || !lessonId) {
      return NextResponse.json(
        { error: "Missing required fields: userId, lessonId." },
        { status: 400 }
      );
    }

    // 2. Verify lesson existence and get parent course ID
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          select: { courseId: true },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found." },
        { status: 404 }
      );
    }

    const courseId = lesson.chapter.courseId;

    // 3. Upsert user progress record
    const updatedProgress = await prisma.userProgress.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      update: {
        isCompleted: Boolean(isCompleted),
        updatedAt: new Date(),
      },
      create: {
        userId,
        lessonId,
        isCompleted: Boolean(isCompleted),
      },
    });

    // 4. Calculate recalculated course completion percentage
    const totalPublishedLessons = await prisma.lesson.count({
      where: {
        chapter: { courseId },
        isPublished: true,
      },
    });

    const completedLessonsCount = await prisma.userProgress.count({
      where: {
        userId,
        isCompleted: true,
        lesson: {
          chapter: { courseId },
          isPublished: true,
        },
      },
    });

    const progressPercentage =
      totalPublishedLessons > 0
        ? Math.round((completedLessonsCount / totalPublishedLessons) * 100)
        : 0;

    return NextResponse.json(
      {
        message: "Lesson progress updated successfully.",
        progress: updatedProgress,
        courseStats: {
          courseId,
          progressPercentage,
          completedCount: completedLessonsCount,
          totalLessons: totalPublishedLessons,
          isCourseCompleted:
            totalPublishedLessons > 0 && completedLessonsCount === totalPublishedLessons,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[UPDATE_PROGRESS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update lesson progress.", details: error.message },
      { status: 500 }
    );
  }
}

// Support POST alias for PUT functionality
export async function POST(req: NextRequest) {
  return PUT(req);
}