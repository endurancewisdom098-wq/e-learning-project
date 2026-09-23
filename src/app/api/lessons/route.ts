 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
// GET: Fetch Lessons (Filtered by chapterId or courseId)
// Endpoint: /api/lessons?chapterId=xxx&isPublished=true
// ----------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const chapterId = searchParams.get("chapterId");
    const courseId = searchParams.get("courseId");
    const isPublished = searchParams.get("isPublished");
    const userId = searchParams.get("userId");

    if (!chapterId && !courseId) {
      return NextResponse.json(
        { error: "At least one query parameter ('chapterId' or 'courseId') is required." },
        { status: 400 }
      );
    }

    // Build filter query
    const whereClause: any = {};

    if (chapterId) {
      whereClause.chapterId = chapterId;
    } else if (courseId) {
      whereClause.chapter = { courseId };
    }

    if (isPublished !== null && isPublished !== undefined) {
      whereClause.isPublished = isPublished === "true";
    }

    // Fetch lessons ordered by position
    const lessons = await prisma.lesson.findMany({
      where: whereClause,
      orderBy: { position: "asc" },
      include: {
        chapter: {
          select: {
            id: true,
            title: true,
            courseId: true,
          },
        },
        // Include completion status if userId is provided
        ...(userId && {
          userProgress: {
            where: { userId },
            select: { isCompleted: true, updatedAt: true },
          },
        }),
      },
    });

    // Format lesson data
    const formattedLessons = lessons.map((lesson) => {
      const isCompleted = userId && lesson.userProgress ? lesson.userProgress.length > 0 && lesson.userProgress[0].isCompleted : false;

      return {
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
        description: lesson.description,
        videoUrl: lesson.videoUrl,
        duration: lesson.duration,
        position: lesson.position,
        isFree: lesson.isFree,
        isPublished: lesson.isPublished,
        chapterId: lesson.chapterId,
        chapterTitle: lesson.chapter.title,
        courseId: lesson.chapter.courseId,
        isCompleted,
        createdAt: lesson.createdAt,
      };
    });

    return NextResponse.json({ lessons: formattedLessons }, { status: 200 });
  } catch (error: any) {
    console.error("[GET_LESSONS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch lessons.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// POST: Create a New Lesson (Instructor Only)
// Endpoint: /api/lessons
// ----------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      title,
      chapterId,
      instructorId,
      description,
      videoUrl,
      duration = 0,
      isFree = false,
      isPublished = false,
    } = body;

    // 1. Basic validation
    if (!title || !chapterId || !instructorId) {
      return NextResponse.json(
        { error: "Missing required fields: title, chapterId, instructorId." },
        { status: 400 }
      );
    }

    // 2. Verify chapter exists and caller owns the parent course
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        course: {
          select: { id: true, instructorId: true },
        },
      },
    });

    if (!chapter) {
      return NextResponse.json(
        { error: "Chapter not found." },
        { status: 404 }
      );
    }

    if (chapter.course.instructorId !== instructorId) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own the course this chapter belongs to." },
        { status: 403 }
      );
    }

    // 3. Determine sequence position (auto-increment position)
    const lastLesson = await prisma.lesson.findFirst({
      where: { chapterId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const newPosition = lastLesson ? lastLesson.position + 1 : 1;

    // 4. Generate unique slug within chapter context
    let baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;

    while (
      await prisma.lesson.findFirst({
        where: { chapterId, slug },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // 5. Create new lesson
    const newLesson = await prisma.lesson.create({
      data: {
        title,
        slug,
        description: description || "",
        videoUrl: videoUrl || null,
        duration: parseInt(duration.toString(), 10) || 0,
        position: newPosition,
        isFree,
        isPublished,
        chapterId,
      },
    });

    return NextResponse.json(
      {
        message: "Lesson created successfully.",
        lesson: newLesson,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_LESSON_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create lesson.", details: error.message },
      { status: 500 }
    );
  }
}