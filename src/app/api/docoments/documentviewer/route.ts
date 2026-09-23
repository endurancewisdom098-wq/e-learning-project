 // app/api/documents/viewer/route.ts

import { NextRequest, NextResponse } from "next/server";

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------
export interface DocumentViewerMetadata {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  courseId: string;
  courseTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  viewUrl: string; // Dynamic presigned viewing URL
  expiresAt: string;
  permissions: {
    canDownload: boolean;
    canPrint: boolean;
  };
}

interface UserSession {
  userId: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}

interface DBDocumentRecord {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  courseId: string;
  courseTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  isPublic: boolean;
  isPublished: boolean;
  allowDownload: boolean;
  allowPrint: boolean;
}

// ----------------------------------------------------------------------
// Mock Helper Functions (Replace with your actual Auth, DB & S3 integrations)
// ----------------------------------------------------------------------

async function getAuthenticatedUser(req: NextRequest): Promise<UserSession | null> {
  const authHeader = req.headers.get("authorization");
  const sessionToken = req.cookies.get("session_token")?.value;

  if (!authHeader && !sessionToken) return null;

  // Replace with NextAuth / Clerk / Kinde / Custom JWT verification
  return {
    userId: "usr_student_123",
    role: "STUDENT",
  };
}

/**
 * Checks if a user has permission to view a specific document.
 */
async function checkDocumentAccess(
  user: UserSession,
  doc: DBDocumentRecord
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (!doc.isPublished && user.role === "STUDENT") return false;
  if (doc.isPublic) return true;

  // Check enrollment or course ownership
  if (user.role === "STUDENT") {
    // Replace with DB query: e.g., await db.enrollment.findFirst({ where: { userId: user.userId, courseId: doc.courseId, status: "ACTIVE" } })
    const enrolledCourses = ["course_99", "course_101"];
    return enrolledCourses.includes(doc.courseId);
  }

  if (user.role === "INSTRUCTOR") {
    // Replace with DB query: e.g., verify instructor owns course
    return true;
  }

  return false;
}

/**
 * Retrieves document record from database.
 */
async function getDocumentById(documentId: string): Promise<DBDocumentRecord | null> {
  // Replace with DB query: e.g., await db.document.findUnique({ where: { id: documentId } })
  if (documentId === "not_found") return null;

  return {
    id: documentId,
    title: "React Server Components Architecture Guide",
    description: "Deep dive into hydration patterns and server-side component rendering.",
    fileName: "rsc_architecture_v2.pdf",
    fileKey: "courses/course_99/docs/rsc_architecture_v2.pdf",
    mimeType: "application/pdf",
    sizeBytes: 3145728,
    courseId: "course_99",
    courseTitle: "Advanced Next.js Mastery",
    lessonId: "lesson_04",
    lessonTitle: "Server vs Client Components",
    isPublic: false,
    isPublished: true,
    allowDownload: true,
    allowPrint: true,
  };
}

/**
 * Generates a short-lived presigned viewing URL from S3 / Cloudflare R2 / Supabase Storage.
 */
async function generatePresignedViewUrl(fileKey: string, mimeType: string, isDownload: boolean): Promise<{ url: string; expiresAt: string }> {
  // Replace with S3 SDK / Cloudflare R2 presigned URL generation:
  // const command = new GetObjectCommand({
  //   Bucket: BUCKET,
  //   Key: fileKey,
  //   ResponseContentType: mimeType,
  //   ResponseContentDisposition: isDownload ? 'attachment' : 'inline',
  // });
  // const url = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 mins

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const storageDomain = process.env.NEXT_PUBLIC_STORAGE_DOMAIN || "https://storage.learnhub.com";
  const url = `${storageDomain}/${fileKey}?token=temp_signed_token_12345&disposition=${isDownload ? "attachment" : "inline"}`;

  return { url, expiresAt };
}

/**
 * Logs document viewing event for student engagement analytics.
 */
async function logDocumentViewEvent(userId: string, documentId: string, courseId: string) {
  // Replace with DB log insertion or analytics ping:
  // await db.documentViewLog.create({ data: { userId, documentId, courseId, viewedAt: new Date() } });
  console.log(`[ANALYTICS] User ${userId} viewed document ${documentId} in course ${courseId}`);
}

// ----------------------------------------------------------------------
// GET /api/documents/viewer
// ----------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Extract Query Parameters
    const documentId = searchParams.get("documentId") || searchParams.get("id");
    const mode = searchParams.get("mode") || "json"; // "json" (returns metadata + presigned URL) or "stream" (direct proxy/stream)
    const isDownload = searchParams.get("download") === "true";

    if (!documentId) {
      return NextResponse.json(
        { error: "Bad Request", message: "Missing required parameter: documentId" },
        { status: 400 }
      );
    }

    // 2. Authenticate User
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required to view document." },
        { status: 401 }
      );
    }

    // 3. Fetch Document Record
    const document = await getDocumentById(documentId);
    if (!document) {
      return NextResponse.json(
        { error: "Not Found", message: "Requested document could not be found." },
        { status: 404 }
      );
    }

    // 4. Verify Access Permissions
    const hasAccess = await checkDocumentAccess(user, document);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden", message: "You do not have access to view this document." },
        { status: 403 }
      );
    }

    // Check if downloading is restricted
    if (isDownload && !document.allowDownload && user.role === "STUDENT") {
      return NextResponse.json(
        { error: "Forbidden", message: "Downloading is disabled for this document." },
        { status: 403 }
      );
    }

    // 5. Generate Signed Viewing URL
    const { url: viewUrl, expiresAt } = await generatePresignedViewUrl(
      document.fileKey,
      document.mimeType,
      isDownload
    );

    // 6. Log View Event Asynchronously
    logDocumentViewEvent(user.userId, document.id, document.courseId).catch((err) =>
      console.error("[VIEW_LOG_ERROR]", err)
    );

    // 7. Handle Stream Proxy Mode (Direct Browser Streaming with range headers support)
    if (mode === "stream") {
      // Fetch binary stream from S3 / CDN and stream back to browser
      const storageResponse = await fetch(viewUrl);

      if (!storageResponse.ok) {
        return NextResponse.json(
          { error: "Bad Gateway", message: "Failed to retrieve stream from storage provider." },
          { status: 502 }
        );
      }

      const headers = new Headers();
      headers.set("Content-Type", document.mimeType);
      headers.set(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(document.fileName)}"`
      );
      headers.set("Cache-Control", "private, max-age=900"); // Cache for 15 minutes
      if (document.sizeBytes) {
        headers.set("Content-Length", document.sizeBytes.toString());
      }

      return new NextResponse(storageResponse.body, {
        status: 200,
        headers,
      });
    }

    // 8. Return Default Metadata Response (JSON)
    const metadataResponse: DocumentViewerMetadata = {
      id: document.id,
      title: document.title,
      description: document.description,
      fileName: document.fileName,
      fileKey: document.fileKey,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      courseId: document.courseId,
      courseTitle: document.courseTitle,
      lessonId: document.lessonId,
      lessonTitle: document.lessonTitle,
      viewUrl,
      expiresAt,
      permissions: {
        canDownload: document.allowDownload,
        canPrint: document.allowPrint,
      },
    };

    return NextResponse.json(
      {
        success: true,
        data: metadataResponse,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DOCUMENT_VIEWER_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to initialize document viewer." },
      { status: 500 }
    );
  }
}