 import { NextRequest, NextResponse } from "next/server";
import { saveFile } from "@/lib/storage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;

    // 1. Authenticate user from header/session (adjust based on your auth helper)
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    if (!userId || (userRole !== "instructor" && userRole !== "admin")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access required." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Untitled Resource";
    const category = (formData.get("category") as string) || "lecture_notes";

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file was uploaded." },
        { status: 400 }
      );
    }

    const courseId = (formData.get("courseId") as string | null)?.trim() || "general";
    const safeCourseId = courseId.replace(/[^a-z0-9_-]/gi, "_");
    const savedFile = await saveFile(
      file,
      ["courses", safeCourseId, "lessons", lessonId, file.name].join("/"),
      {
        overwrite: false,
        mimeType: file.type || "application/octet-stream",
      }
    );

    const documentRecord = {
      id: savedFile.id,
      title,
      fileName: savedFile.fileName,
      fileUrl: savedFile.publicUrl,
      mimeType: savedFile.mimeType,
      fileSize: savedFile.size,
      category,
      lessonId,
      uploadedBy: userId,
      uploadedAt: savedFile.uploadedAt,
    };

    return NextResponse.json(
      {
        success: true,
        message: "Resource attached to lesson successfully.",
        data: documentRecord,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Instructor Upload Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to upload resource." },
      { status: 500 }
    );
  }
}