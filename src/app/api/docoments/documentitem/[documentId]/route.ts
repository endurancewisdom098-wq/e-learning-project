// app/api/documents/[documentId]/route.ts

import { NextRequest, NextResponse } from "next/server";

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------
export interface DocumentItem {
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
  createdAt: string;
  updatedAt: string;
}

export interface UpdateDocumentInput {
  title?: string;
  description?: string;
  lessonId?: string;
  isPublic?: boolean;
  isPublished?: boolean;
}

interface UserSession {
  userId: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

// ----------------------------------------------------------------------
// Mock Helper Functions (Replace with your actual DB & Auth integrations)
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

async function getDocumentById(documentId: string): Promise<DocumentItem | null> {
  if (documentId === "invalid") return null;

  return {
    id: documentId,
    title: "Module 2 - Component Lifecycle Cheatsheet",
    description: "Overview of mounting, updating, and unmounting phases.",
    fileName: "react_lifecycle.pdf",
    fileKey: "courses/course_99/docs/react_lifecycle.pdf",
    fileUrl: "https://storage.example.com/courses/course_99/docs/react_lifecycle.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1048576, // 1 MB
    courseId: "course_99",
    lessonId: "lesson_12",
    isPublic: false,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function verifyCourseOwnershipOrAccess(
  userId: string,
  courseId: string,
  role: string,
  requireManagePermission = false
): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (requireManagePermission && role !== "INSTRUCTOR") return false;

  // Replace with DB lookup checking instructor ownership or student enrollment
  return true;
}

async function deleteFromStorage(fileKey: string): Promise<boolean> {
  // Replace with AWS S3 / Cloudflare R2 / Supabase Storage file deletion logic
  // e.g., await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }))
  return true;
}

// ----------------------------------------------------------------------
// GET /api/documents/[documentId]
// Retrieve details and metadata for a specific document
// ----------------------------------------------------------------------
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;

    if (!documentId) {
      return NextResponse.json(
        { error: "Bad Request", message: "Document ID parameter is required." },
        { status: 400 }
      );
    }

    const document = await getDocumentById(documentId);
    if (!document) {
      return NextResponse.json(
        { error: "Not Found", message: "Document not found." },
        { status: 404 }
      );
    }

    const user = await getAuthenticatedUser(request);

    // Enforce privacy controls if document isn't public
    if (!document.isPublic) {
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication required to access this resource." },
          { status: 401 }
        );
      }

      const hasAccess = await verifyCourseOwnershipOrAccess(
        user.userId,
        document.courseId,
        user.role
      );

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Forbidden", message: "You do not have permission to view this document." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, data: document }, { status: 200 });
  } catch (error) {
    console.error("[DOCUMENT_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch document item." },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// PATCH /api/documents/[documentId]
// Update document metadata (title, lesson assignment, visibility)
// ----------------------------------------------------------------------
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required." },
        { status: 401 }
      );
    }

    const existingDoc = await getDocumentById(documentId);
    if (!existingDoc) {
      return NextResponse.json(
        { error: "Not Found", message: "Document not found." },
        { status: 404 }
      );
    }

    // Verify instructor/admin permissions
    const canManage = await verifyCourseOwnershipOrAccess(
      user.userId,
      existingDoc.courseId,
      user.role,
      true
    );

    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only course instructors or admins can edit documents." },
        { status: 403 }
      );
    }

    const body: UpdateDocumentInput = await request.json();

    // Field Validation
    if (body.title !== undefined && body.title.trim().length === 0) {
      return NextResponse.json(
        { error: "Validation Error", message: "Title cannot be empty." },
        { status: 400 }
      );
    }

    // Replace with DB Update Query (e.g., Prisma / Drizzle)
    const updatedDocument: DocumentItem = {
      ...existingDoc,
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.description !== undefined && { description: body.description.trim() }),
      ...(body.lessonId !== undefined && { lessonId: body.lessonId }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: updatedDocument }, { status: 200 });
  } catch (error) {
    console.error("[DOCUMENT_PATCH_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to update document item." },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// DELETE /api/documents/[documentId]
// Delete document record from DB and purge physical file from cloud storage
// ----------------------------------------------------------------------
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required." },
        { status: 401 }
      );
    }

    const existingDoc = await getDocumentById(documentId);
    if (!existingDoc) {
      return NextResponse.json(
        { error: "Not Found", message: "Document not found." },
        { status: 404 }
      );
    }

    const canManage = await verifyCourseOwnershipOrAccess(
      user.userId,
      existingDoc.courseId,
      user.role,
      true
    );

    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only course instructors or admins can delete documents." },
        { status: 403 }
      );
    }

    // 1. Delete physical object from cloud bucket
    await deleteFromStorage(existingDoc.fileKey);

    // 2. Delete record from database (e.g., await db.document.delete({ where: { id: documentId } }))

    return NextResponse.json(
      { success: true, message: "Document deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DOCUMENT_DELETE_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to delete document item." },
      { status: 500 }
    );
  }
}