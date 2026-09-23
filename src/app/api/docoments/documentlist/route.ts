 // app/api/documents/list/route.ts

import { NextRequest, NextResponse } from "next/server";

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------
export interface DocumentListItem {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  courseId: string;
  courseTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  isPublic: boolean;
  isPublished: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListQueryParams {
  courseId?: string;
  lessonId?: string;
  search?: string;
  isPublished?: boolean;
  page: number;
  limit: number;
  sortBy: "createdAt" | "title" | "sizeBytes";
  sortOrder: "asc" | "desc";
}

interface UserSession {
  userId: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}

// ----------------------------------------------------------------------
// Mock Helper Functions (Replace with your actual Auth & DB integrations)
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
 * Returns list of course IDs the student is actively enrolled in.
 */
async function getUserEnrolledCourseIds(userId: string): Promise<string[]> {
  // Replace with DB lookup: e.g., await db.enrollment.findMany({ where: { userId, status: "ACTIVE" }, select: { courseId: true } })
  return ["course_99", "course_101"];
}

/**
 * Queries database for documents matching filters, authorization scope, and pagination params.
 */
async function fetchDocumentsFromDb(
  params: DocumentListQueryParams,
  allowedCourseIds: string[] | null, // null = no course restrictions (Admin/Instructor)
  userRole: UserSession["role"]
): Promise<{ documents: DocumentListItem[]; totalCount: number }> {
  // Example Prisma Query structure:
  /*
  const whereClause: Prisma.DocumentWhereInput = {
    AND: [
      params.courseId ? { courseId: params.courseId } : {},
      params.lessonId ? { lessonId: params.lessonId } : {},
      params.search ? {
        OR: [
          { title: { contains: params.search, mode: 'insensitive' } },
          { fileName: { contains: params.search, mode: 'insensitive' } },
        ]
      } : {},
      // Enforce published-only for students
      userRole === "STUDENT" ? { isPublished: true } : (params.isPublished !== undefined ? { isPublished: params.isPublished } : {}),
      // Role-based visibility scoping
      userRole === "STUDENT" ? {
        OR: [
          { isPublic: true },
          { courseId: { in: allowedCourseIds ?? [] } }
        ]
      } : {}
    ]
  };

  const [documents, totalCount] = await Promise.all([
    db.document.findMany({
      where: whereClause,
      orderBy: { [params.sortBy]: params.sortOrder },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: { course: { select: { title: true } }, lesson: { select: { title: true } } }
    }),
    db.document.count({ where: whereClause })
  ]);
  */

  // Mocked response dataset
  const mockDocuments: DocumentListItem[] = [
    {
      id: "doc_101",
      title: "Module 1 - Architecture & Setup Guide",
      description: "Getting started with Next.js App Router and Tailwind CSS.",
      fileName: "architecture_setup.pdf",
      fileKey: "courses/course_99/docs/architecture_setup.pdf",
      fileUrl: "https://storage.learnhub.com/courses/course_99/docs/architecture_setup.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048000, // ~2 MB
      courseId: "course_99",
      courseTitle: "Advanced Web Development",
      lessonId: "lesson_01",
      lessonTitle: "Introduction & Environment Setup",
      isPublic: false,
      isPublished: true,
      uploadedBy: "usr_instructor_456",
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "doc_102",
      title: "Course Syllabus & Schedule",
      description: "Complete list of modules, assignments, and grading policy.",
      fileName: "course_syllabus.pdf",
      fileKey: "courses/course_99/docs/course_syllabus.pdf",
      fileUrl: "https://storage.learnhub.com/courses/course_99/docs/course_syllabus.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512000, // ~512 KB
      courseId: "course_99",
      courseTitle: "Advanced Web Development",
      isPublic: true,
      isPublished: true,
      uploadedBy: "usr_instructor_456",
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
  ];

  let filtered = mockDocuments;

  if (params.courseId) {
    filtered = filtered.filter((doc) => doc.courseId === params.courseId);
  }

  if (params.lessonId) {
    filtered = filtered.filter((doc) => doc.lessonId === params.lessonId);
  }

  if (params.search) {
    const query = params.search.toLowerCase();
    filtered = filtered.filter(
      (doc) =>
        doc.title.toLowerCase().includes(query) ||
        doc.fileName.toLowerCase().includes(query)
    );
  }

  return {
    documents: filtered,
    totalCount: filtered.length,
  };
}

// ----------------------------------------------------------------------
// GET /api/documents/list
// ----------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Extract and Sanitize Query Parameters
    const courseId = searchParams.get("courseId") || undefined;
    const lessonId = searchParams.get("lessonId") || undefined;
    const search = searchParams.get("search")?.trim() || undefined;

    const isPublishedParam = searchParams.get("isPublished");
    const isPublished =
      isPublishedParam !== null ? isPublishedParam === "true" : undefined;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const rawLimit = parseInt(searchParams.get("limit") || "10", 10);
    const limit = Math.min(Math.max(1, rawLimit), 100); // Clamp limit between 1 and 100

    const sortByParam = searchParams.get("sortBy") || "createdAt";
    const sortBy = ["createdAt", "title", "sizeBytes"].includes(sortByParam)
      ? (sortByParam as DocumentListQueryParams["sortBy"])
      : "createdAt";

    const sortOrderParam = searchParams.get("sortOrder")?.toLowerCase() || "desc";
    const sortOrder: "asc" | "desc" = sortOrderParam === "asc" ? "asc" : "desc";

    // 2. Authentication Check
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required to view course documents." },
        { status: 401 }
      );
    }

    // 3. Role-Based Permission Scope
    let allowedCourseIds: string[] | null = null;

    if (user.role === "STUDENT") {
      // Students can only access public resources or documents in their enrolled courses
      allowedCourseIds = await getUserEnrolledCourseIds(user.userId);
    }

    // 4. Construct Query State Object
    const queryParams: DocumentListQueryParams = {
      courseId,
      lessonId,
      search,
      isPublished,
      page,
      limit,
      sortBy,
      sortOrder,
    };

    // 5. Query Database
    const { documents, totalCount } = await fetchDocumentsFromDb(
      queryParams,
      allowedCourseIds,
      user.role
    );

    // 6. Calculate Pagination Metadata
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // 7. Structured Response
    return NextResponse.json(
      {
        success: true,
        data: documents,
        pagination: {
          page,
          limit,
          totalItems: totalCount,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
        filtersApplied: {
          courseId: courseId || null,
          lessonId: lessonId || null,
          search: search || null,
          isPublished: isPublished ?? null,
          sortBy,
          sortOrder,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DOCUMENT_LIST_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to retrieve documents list." },
      { status: 500 }
    );
  }
}