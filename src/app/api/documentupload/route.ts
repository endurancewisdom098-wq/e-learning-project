 // app/api/documents/upload/route.ts

import { NextRequest, NextResponse } from "next/server";

// ----------------------------------------------------------------------
// Configuration & Constraints
// ----------------------------------------------------------------------
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB limit

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/plain",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------
export interface UploadedDocumentRecord {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  courseId: string;
  lessonId?: string;
  isPublic: boolean;
  isPublished: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface UserSession {
  userId: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}

// ----------------------------------------------------------------------
// Mock Helper Functions (Replace with your DB & Cloud Storage integrations)
// ----------------------------------------------------------------------

async function getAuthenticatedUser(req: NextRequest): Promise<UserSession | null> {
  const authHeader = req.headers.get("authorization");
  const sessionToken = req.cookies.get("session_token")?.value;

  if (!authHeader && !sessionToken) return null;

  // Replace with NextAuth / Clerk / Kinde / Custom JWT verification
  return {
    userId: "usr_instructor_456",
    role: "INSTRUCTOR",
  };
}

async function verifyCourseManagementPermission(userId: string, courseId: string, role: string): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "INSTRUCTOR") return false;

  // Replace with DB query checking if instructor owns/teaches the course
  // e.g., const course = await db.course.findFirst({ where: { id: courseId, instructorId: userId } });
  return true;
}

/**
 * Uploads file buffer/stream to Cloud Storage (AWS S3, Cloudflare R2, Supabase Storage, etc.)
 */
async function uploadToCloudStorage(
  file: File,
  fileKey: string
): Promise<{ fileUrl: string; fileKey: string }> {
  // Option A (S3 / R2 SDK):
  // const arrayBuffer = await file.arrayBuffer();
  // const buffer = Buffer.from(arrayBuffer);
  // await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: fileKey, Body: buffer, ContentType: file.type }));

  // Option B Mock Output
  const storageDomain = process.env.NEXT_PUBLIC_STORAGE_DOMAIN || "https://storage.learnhub.com";
  return {
    fileKey,
    fileUrl: `${storageDomain}/${fileKey}`,
  };
}

/**
 * Persists the document record in the primary database.
 */
async function saveDocumentToDb(data: Omit<UploadedDocumentRecord, "id" | "createdAt" | "updatedAt">): Promise<UploadedDocumentRecord> {
  // Replace with DB insert query (e.g., Prisma, Drizzle, Supabase)
  return {
    id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sanitizes original filename to prevent storage key injection and encoding issues.
 */
function sanitizeFileName(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}

// ----------------------------------------------------------------------
// POST /api/documents/upload
// ----------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication Check
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required to upload documents." },
        { status: 401 }
      );
    }

    // 2. Parse Multipart Form Data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid form data payload." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    const courseId = formData.get("courseId") as string | null;
    const lessonId = (formData.get("lessonId") as string | null) || undefined;
    const customTitle = (formData.get("title") as string | null)?.trim();
    const description = (formData.get("description") as string | null)?.trim() || undefined;
    const isPublic = formData.get("isPublic") === "true";
    const isPublished = formData.get("isPublished") !== "false"; // Defaults to true unless explicitly 'false'

    // 3. Payload & File Validation
    if (!file) {
      return NextResponse.json(
        { error: "Bad Request", message: "Missing required file field." },
        { status: 400 }
      );
    }

    if (!courseId) {
      return NextResponse.json(
        { error: "Bad Request", message: "Missing required parameter: courseId" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: "Payload Too Large",
          message: `File size exceeds the maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
        },
        { status: 413 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: "Unsupported Media Type",
          message: `Invalid file type (${file.type}). Allowed formats: PDF, Word, PowerPoint, Excel, Images, TXT, and ZIP.`,
        },
        { status: 415 }
      );
    }

    // 4. Authorization & Course Ownership Check
    const canUpload = await verifyCourseManagementPermission(user.userId, courseId, user.role);
    if (!canUpload) {
      return NextResponse.json(
        { error: "Forbidden", message: "You do not have permission to add documents to this course." },
        { status: 403 }
      );
    }

    // 5. Construct Storage Key & Upload File
    const sanitizedName = sanitizeFileName(file.name);
    const uniqueKey = `courses/${courseId}/documents/${Date.now()}_${sanitizedName}`;

    const { fileUrl, fileKey } = await uploadToCloudStorage(file, uniqueKey);

    // 6. Save Document Record to Database
    const title = customTitle || file.name.replace(/\.[^/.]+$/, ""); // Default to original filename minus extension

    const documentRecord = await saveDocumentToDb({
      title,
      description,
      fileName: file.name,
      fileKey,
      fileUrl,
      mimeType: file.type,
      sizeBytes: file.size,
      courseId,
      lessonId,
      isPublic,
      isPublished,
      uploadedBy: user.userId,
    });

    // 7. Success Response
    return NextResponse.json(
      {
        success: true,
        message: "Document uploaded successfully.",
        data: documentRecord,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[DOCUMENT_UPLOAD_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "An unexpected error occurred during document upload." },
      { status: 500 }
    );
  }
}