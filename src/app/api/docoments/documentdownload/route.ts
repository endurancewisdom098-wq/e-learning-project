 // app/api/documents/download/route.ts

import { NextRequest, NextResponse } from "next/server";

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------
interface DocumentMetadata {
  id: string;
  title: string;
  fileName: string;
  fileKey: string; // Storage key/path (e.g., S3, Supabase Storage, Uploadthing)
  mimeType: string;
  sizeBytes: number;
  courseId: string;
  isPublic: boolean;
}

interface UserSession {
  userId: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}

// ----------------------------------------------------------------------
// Mock Helper Functions (Replace with your actual DB & Auth integrations)
// ----------------------------------------------------------------------

/**
 * Validates user session from request headers or cookie cookies.
 */
async function getAuthenticatedUser(req: NextRequest): Promise<UserSession | null> {
  const authHeader = req.headers.get("authorization");
  const sessionToken = req.cookies.get("session_token")?.value;

  if (!authHeader && !sessionToken) {
    return null;
  }

  // Replace with NextAuth / Clerk / Kinde / Custom JWT verification
  return {
    userId: "usr_student_123",
    role: "STUDENT",
  };
}

/**
 * Fetches document metadata from the database (e.g., Prisma, Drizzle, Supabase).
 */
async function getDocumentMetadata(documentId: string): Promise<DocumentMetadata | null> {
  // Replace with DB query (e.g., db.document.findUnique({ where: { id: documentId } }))
  if (documentId === "invalid") return null;

  return {
    id: documentId,
    title: "React Fundamentals - Module 1 Lecture Notes",
    fileName: "react_fundamentals_m1.pdf",
    fileKey: "courses/course_99/modules/react_fundamentals_m1.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2458000, // ~2.45 MB
    courseId: "course_99",
    isPublic: false,
  };
}

/**
 * Checks if a user has access to a specific course resource.
 */
async function verifyEnrollmentOrAccess(userId: string, courseId: string, role: string): Promise<boolean> {
  if (role === "ADMIN" || role === "INSTRUCTOR") return true;

  // Replace with DB query checking active enrollment
  // e.g., await db.enrollment.findFirst({ where: { userId, courseId, status: "ACTIVE" } })
  return true;
}

/**
 * Fetches the file stream/buffer from cloud storage (e.g., AWS S3, Cloudflare R2, Supabase).
 */
async function fetchFileFromStorage(fileKey: string): Promise<ReadableStream | ArrayBuffer | null> {
  // Option A: If using AWS S3 / R2 SDK:
  // const s3Object = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey }));
  // return s3Object.Body?.transformToWebStream();

  // Option B: If fetching from a protected internal storage URL or CDN:
  const storageUrl = `${process.env.STORAGE_BASE_URL}/${fileKey}`;
  const response = await fetch(storageUrl, {
    headers: {
      Authorization: `Bearer ${process.env.STORAGE_SECRET_KEY}`,
    },
  });

  if (!response.ok) return null;
  return response.body;
}

// ----------------------------------------------------------------------
// Route Handler: GET /api/documents/download?documentId=xxx
// ----------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    // 1. Parameter Validation
    if (!documentId) {
      return NextResponse.json(
        { error: "Bad Request", message: "Missing required query parameter: documentId" },
        { status: 400 }
      );
    }

    // 2. Authentication Check
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be logged in to download course materials." },
        { status: 401 }
      );
    }

    // 3. Document Retrieval
    const document = await getDocumentMetadata(documentId);
    if (!document) {
      return NextResponse.json(
        { error: "Not Found", message: "The requested document does not exist." },
        { status: 404 }
      );
    }

    // 4. Authorization & Access Control Check
    if (!document.isPublic) {
      const hasAccess = await verifyEnrollmentOrAccess(user.userId, document.courseId, user.role);
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Forbidden", message: "You are not enrolled in this course." },
          { status: 403 }
        );
      }
    }

    // 5. Fetch File Stream from Storage Provider
    const fileStream = await fetchFileFromStorage(document.fileKey);
    if (!fileStream) {
      return NextResponse.json(
        { error: "Storage Error", message: "Failed to retrieve the file from storage." },
        { status: 502 }
      );
    }

    // 6. Encode Filename for Content-Disposition (Handles special characters cleanly)
    const encodedFileName = encodeURIComponent(document.fileName).replace(/['()]/g, escape).replace(/\*/g, "%2A");

    // 7. Construct Response Headers for Download
    const headers = new Headers();
    headers.set("Content-Type", document.mimeType || "application/octet-stream");
    headers.set("Content-Length", document.sizeBytes.toString());
    // Forces browser download prompt instead of inline preview
    headers.set("Content-Disposition", `attachment; filename="${document.fileName}"; filename*=UTF-8''${encodedFileName}`);
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

    // Return stream response
    return new NextResponse(fileStream as ReadableStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[DOCUMENT_DOWNLOAD_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "An unexpected error occurred during document download." },
      { status: 500 }
    );
  }
}