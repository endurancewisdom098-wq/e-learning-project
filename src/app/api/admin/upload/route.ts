  import { NextRequest, NextResponse } from "next/server";
  import { saveFile } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    if (!userId || userRole !== "admin") {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden. System Administrator privileges are required.",
        },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "";
    const category = (formData.get("category") as string) || "system_asset";
    const courseId = (formData.get("courseId") as string) || null;
    const lessonId = (formData.get("lessonId") as string) || null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file attached to request." },
        { status: 400 }
      );
    }

    const safeCategoryDir = category.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    const safeCourseId = (courseId || "general").replace(/[^a-z0-9_-]/gi, "_");
    const safeLessonId = (lessonId || "general").replace(/[^a-z0-9_-]/gi, "_");
    const savedFile = await saveFile(
      file,
      ["admin", safeCategoryDir, safeCourseId, safeLessonId, file.name].join("/"),
      {
        overwrite: false,
        mimeType: file.type || "application/octet-stream",
      }
    );

    const documentRecord = {
      id: savedFile.id,
      title: title.trim() || file.name,
      fileName: savedFile.fileName,
      fileUrl: savedFile.publicUrl,
      mimeType: savedFile.mimeType,
      fileSize: savedFile.size,
      category,
      courseId,
      lessonId,
      uploadedBy: userId,
      uploadedAt: savedFile.uploadedAt,
    };

    return NextResponse.json(
      {
        success: true,
        message: "Admin asset uploaded successfully.",
        data: documentRecord,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin Upload API Error:", error);
    const message = error instanceof Error ? error.message : "An internal error occurred during upload.";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}