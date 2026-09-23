 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ----------------------------------------------------------------------
// GET: Fetch Progress Entry by Progress ID or Lesson ID
// Endpoint: /api/progress/[id]?userId=xxx
// Note: [id] can be either a UserProgress ID or a Lesson ID
// ----------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // 1. Try finding by direct UserProgress record ID
    let progress = await prisma.userProgress.findUnique({
      where: { id },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            slug: true,
            position: true,
            chapterId: true,
            chapter: {
              select: {
                id: true,
                title: true,
                courseId: true,
              },
            },
          },
        },
      },
    });

    // 2. Fallback: Treat [id] as a lessonId if userId is provided
    if (!progress && userId) {
      progress = await prisma.userProgress.findUnique({
        where: {
          userId_lessonId: {
            userId,
            lessonId: id,
          },
        },
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              slug: true,
              position: true,
              chapterId: true,
              chapter: {
                select: {
                  id: true,
                  title: true,
                  courseId: true,
                },
              },
            },
          },
        },
      });
    }

    if (!progress) {
      return NextResponse.json(
        {
          progress: {
            id: null,
            userId: userId || null,
            lessonId: id,
            isCompleted: false,
            updatedAt: null,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ progress }, { status: 200 });
  } catch (error: any) {
    console.error("[GET_PROGRESS_BY_ID_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch progress detail.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// PATCH: Update Progress Status or Video Timestamp
// Endpoint: /api/progress/[id]
// Note: [id] can be either UserProgress ID or Lesson ID (when userId is in body)
// ----------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { userId, isCompleted, lastPositionSeconds } = body;

    // 1. Check if direct UserProgress record exists
    const existingProgress = await prisma.userProgress.findUnique({
      where: { id },
    });

    let targetProgressId = existingProgress?.id;
    let targetUserId = existingProgress?.userId || userId;
    let targetLessonId = existingProgress?.lessonId || id;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Missing required 'userId' to update progress." },
        { status: 400 }
      );
    }

    // 2. Upsert progress using composite key (userId_lessonId) or direct ID
    const updatedProgress = await prisma.userProgress.upsert({
      where: targetProgressId
        ? { id: targetProgressId }
        : {
            userId_lessonId: {
              userId: targetUserId,
              lessonId: targetLessonId,
            },
          },
      update: {
        ...(isCompleted !== undefined && { isCompleted: Boolean(isCompleted) }),
        ...(lastPositionSeconds !== undefined && {
          lastPositionSeconds: parseInt(lastPositionSeconds.toString(), 10),
        }),
        updatedAt: new Date(),
      },
      create: {
        userId: targetUserId,
        lessonId: targetLessonId,
        isCompleted: isCompleted !== undefined ? Boolean(isCompleted) : false,
        ...(lastPositionSeconds !== undefined && {
          lastPositionSeconds: parseInt(lastPositionSeconds.toString(), 10),
        }),
      },
      include: {
        lesson: {
          select: {
            chapterId: true,
            chapter: { select: { courseId: true } },
          },
        },
      },
    });

    // 3. Recalculate parent course progress
    const courseId = updatedProgress.lesson.chapter.courseId;

    const totalPublishedLessons = await prisma.lesson.count({
      where: {
        chapter: { courseId },
        isPublished: true,
      },
    });

    const completedCount = await prisma.userProgress.count({
      where: {
        userId: targetUserId,
        isCompleted: true,
        lesson: {
          chapter: { courseId },
          isPublished: true,
        },
      },
    });

    const progressPercentage =
      totalPublishedLessons > 0
        ? Math.round((completedCount / totalPublishedLessons) * 100)
        : 0;

    return NextResponse.json(
      {
        message: "Progress updated successfully.",
        progress: updatedProgress,
        courseStats: {
          courseId,
          progressPercentage,
          completedCount,
          totalLessons: totalPublishedLessons,
          isCourseCompleted:
            totalPublishedLessons > 0 && completedCount === totalPublishedLessons,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[UPDATE_PROGRESS_BY_ID_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update progress.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// DELETE: Reset Progress Record (Mark Lesson as Uncompleted)
// Endpoint: /api/progress/[id]?userId=xxx
// ----------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // 1. Locate record by ID or composite key
    let progressRecord = await prisma.userProgress.findUnique({
      where: { id },
    });

    if (!progressRecord && userId) {
      progressRecord = await prisma.userProgress.findUnique({
        where: {
          userId_lessonId: {
            userId,
            lessonId: id,
          },
        },
      });
    }

    if (!progressRecord) {
      return NextResponse.json(
        { error: "Progress record not found." },
        { status: 404 }
      );
    }

    // 2. Delete progress entry
    await prisma.userProgress.delete({
      where: { id: progressRecord.id },
    });

    return NextResponse.json(
      { message: "Lesson progress reset successfully." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[DELETE_PROGRESS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to reset lesson progress.", details: error.message },
      { status: 500 }
    );
  }
}