import { NextRequest, NextResponse } from "next/server";
import { saveFile } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const fileValue = formData.get("file");
    const file = fileValue instanceof File ? fileValue : null;
    const title = (formData.get("title") as string | null)?.trim();
    const courseId = (formData.get("courseId") as string | null)?.trim();
    const lessonId = (formData.get("lessonId") as string | null)?.trim();
    const category =
      (formData.get("category") as string | null)?.trim() || "lecture_notes";

    if (!file || file.size === 0 || !title || !courseId) {
      return NextResponse.json(
        { success: false, message: "Missing required upload fields." },
        { status: 400 }
      );
    }

    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "File exceeds the 500 MB upload limit." },
        { status: 413 }
      );
    }

    const safeCategory = category.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    const safeCourseId = courseId.replace(/[^a-z0-9_-]/gi, "_");
    const safeLessonId = (lessonId || "general").replace(/[^a-z0-9_-]/gi, "_");
    const safeFileName = file.name
      .split(/[\\/]/)
      .pop()
      ?.replace(/[^a-z0-9._-]/gi, "_") || "upload.bin";
    const relativePath = [
      "courses",
      safeCourseId,
      safeCategory,
      safeLessonId,
      safeFileName,
    ].join("/");

    const savedFile = await saveFile(file, relativePath, {
      overwrite: false,
      mimeType: file.type || "application/octet-stream",
    });

    return NextResponse.json(
      {
        success: true,
        message: "File uploaded successfully.",
        data: {
          id: savedFile.id,
          title,
          fileName: savedFile.fileName,
          fileUrl: savedFile.publicUrl,
          mimeType: savedFile.mimeType,
          fileSize: savedFile.size,
          category,
          courseId,
          lessonId: lessonId || null,
          uploadedAt: savedFile.uploadedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "File upload failed.";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}