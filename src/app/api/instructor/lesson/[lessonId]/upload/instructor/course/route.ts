 import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Course from "@/models/Course";
import Lesson from "@/models/lesson";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    // 1. Authenticate Instructor
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    if (!userId || (userRole !== "instructor" && userRole !== "admin")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access required." },
        { status: 403 }
      );
    }

    // 2. Extract Data
    const body = await req.json();
    const {
      title,
      description,
      category,
      level,
      price,
      isFree,
      thumbnailUrl,
      previewVideoUrl,
      modules = [],
      isPublished = false,
    } = body;

    // 3. Validation
    if (!title || !description || !category) {
      return NextResponse.json(
        { success: false, message: "Title, description, and category are required." },
        { status: 400 }
      );
    }

    // 4. Create Base Course Record
    const newCourse = await Course.create({
      title,
      description,
      category,
      level: level || "All Levels",
      price: isFree ? 0 : Number(price) || 0,
      isFree: Boolean(isFree),
      thumbnailUrl: thumbnailUrl || "",
      previewVideoUrl: previewVideoUrl || "",
      instructorId: userId,
      isPublished: Boolean(isPublished),
      enrolledCount: 0,
    });

    // 5. Process Initial Curriculum Modules & Lessons
    if (Array.isArray(modules) && modules.length > 0) {
      const createdLessonIds: string[] = [];

      for (let mIdx = 0; mIdx < modules.length; mIdx++) {
        const module = modules[mIdx];
        if (Array.isArray(module.lessons)) {
          for (let lIdx = 0; lIdx < module.lessons.length; lIdx++) {
            const lessonData = module.lessons[lIdx];
            if (lessonData.title) {
              const newLesson = await Lesson.create({
                title: lessonData.title,
                courseId: newCourse._id,
                moduleTitle: module.moduleTitle || `Module ${mIdx + 1}`,
                order: lIdx + 1,
                videoUrl: lessonData.videoUrl || "",
                content: lessonData.content || "",
                isFreePreview: Boolean(lessonData.isFreePreview),
              });
              createdLessonIds.push(newLesson._id);
            }
          }
        }
      }

      // Link lessons back to course if model tracks references
      if (createdLessonIds.length > 0) {
        await Course.findByIdAndUpdate(newCourse._id, {
          $set: { lessons: createdLessonIds },
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: isPublished ? "Course published successfully!" : "Course draft saved!",
        data: { courseId: newCourse._id },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Course Creation Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create course." },
      { status: 500 }
    );
  }
}