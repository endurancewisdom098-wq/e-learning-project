 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper function to create URL-safe slugs
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ----------------------------------------------------------------------
// GET: Fetch Single Lesson Details (with Enrollment & Navigation metadata)
// Endpoint: /api/lessons/[id]?userId=xxx
// ----------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // Fetch lesson by ID or Slug
    const lesson = await prisma.lesson.findFirst({
      where: {
        OR: [{ id: id }, { slug: id }],
      },
      include: {
        chapter: {
          select: {
            id: true,
            title: true,
            position: true,
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                instructorId: true,
              },
            },
          },
        },
        userProgress: userId
          ? {
              where: { userId },
              select: { isCompleted: true, updatedAt: true },
            }
          : false,
      },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found." },
        { status: 404 }
      );
    }

    const courseId = lesson.chapter.course.id;
    const instructorId = lesson.chapter.course.instructorId;

    // Check permissions
    let isEnrolled = false;
    let isInstructor = userId === instructorId;

    if (userId && !isInstructor) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
      });
      isEnrolled = !!enrollment;
    }

    // Access control: Restricted video stream if lesson is paid and user is not enrolled/instructor
    const isAccessible = lesson.isFree || isEnrolled || isInstructor;

    // Calculate Next and Previous Lesson Navigation
    const allChapterLessons = await prisma.lesson.findMany({
      where: {
        chapterId: lesson.chapterId,
        isPublished: true,
      },
      orderBy: { position: "asc" },
      select: { id: true, title: true, slug: true, position: true },
    });

    const currentIndex = allChapterLessons.findIndex((l) => l.id === lesson.id);
    const previousLesson = currentIndex > 0 ? allChapterLessons[currentIndex - 1] : null;
    const nextLesson =
      currentIndex >= 0 && currentIndex < allChapterLessons.length - 1
        ? allChapterLessons[currentIndex + 1]
        : null;

    const isCompleted =
      userId && lesson.userProgress && lesson.userProgress.length > 0
        ? lesson.userProgress[0].isCompleted
        : false;

    return NextResponse.json(
      {
        lesson: {
          ...lesson,
          videoUrl: isAccessible ? lesson.videoUrl : null,
          isAccessible,
          isCompleted,
        },
        navigation: {
          previousLesson,
          nextLesson,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GET_LESSON_BY_ID_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch lesson details.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// PATCH: Update Lesson Details, Media, or Status (Instructor Only)
// Endpoint: /api/lessons/[id]
// ----------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const {
      title,
      description,
      videoUrl,
      duration,
      position,
      isFree,
      isPublished,
      instructorId,
    } = body;

    if (!instructorId) {
      return NextResponse.json(
        { error: "Instructor ID is required for authorization validation." },
        { status: 400 }
      );
    }

    // 1. Check lesson existence and instructor ownership
    const existingLesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        chapter: {
          select: {
            id: true,
            course: { select: { id: true, instructorId: true } },
          },
        },
      },
    });

    if (!existingLesson) {
      return NextResponse.json(
        { error: "Lesson not found." },
        { status: 404 }
      );
    }

    if (existingLesson.chapter.course.instructorId !== instructorId) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own this lesson." },
        { status: 403 }
      );
    }

    // 2. Generate new slug if title changed
    let newSlug: string | undefined;
    if (title && title !== existingLesson.title) {
      let baseSlug = slugify(title);
      newSlug = baseSlug;
      let counter = 1;

      while (
        await prisma.lesson.findFirst({
          where: {
            chapterId: existingLesson.chapterId,
            slug: newSlug,
            NOT: { id },
          },
        })
      ) {
        newSlug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    // 3. Update Lesson
    const updatedLesson = await prisma.lesson.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(newSlug && { slug: newSlug }),
        ...(description !== undefined && { description }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(duration !== undefined && { duration: parseInt(duration.toString(), 10) }),
        ...(position !== undefined && { position: parseInt(position.toString(), 10) }),
        ...(isFree !== undefined && { isFree }),
        ...(isPublished !== undefined && { isPublished }),
      },
    });

    return NextResponse.json(
      {
        message: "Lesson updated successfully.",
        lesson: updatedLesson,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[UPDATE_LESSON_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update lesson.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// DELETE: Delete Lesson and Reorder Remaining Lessons (Instructor Only)
// Endpoint: /api/lessons/[id]?instructorId=xxx
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

    // 1. Verify ownership
    const existingLesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        chapter: {
          select: {
            id: true,
            course: { select: { instructorId: true } },
          },
        },
      },
    });

    if (!existingLesson) {
      return NextResponse.json(
        { error: "Lesson not found." },
        { status: 404 }
      );
    }

    if (existingLesson.chapter.course.instructorId !== instructorId) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own this lesson." },
        { status: 403 }
      );
    }

    const chapterId = existingLesson.chapterId;
    const deletedPosition = existingLesson.position;

    // 2. Delete lesson and update positions of remaining lessons in chapter
    await prisma.$transaction([
      prisma.lesson.delete({
        where: { id },
      }),
      prisma.lesson.updateMany({
        where: {
          chapterId,
          position: { gt: deletedPosition },
        },
        data: {
          position: { decrement: 1 },
        },
      }),
    ]);

    return NextResponse.json(
      { message: "Lesson deleted and remaining lesson positions reordered." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[DELETE_LESSON_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete lesson.", details: error.message },
      { status: 500 }
    );
  }
}