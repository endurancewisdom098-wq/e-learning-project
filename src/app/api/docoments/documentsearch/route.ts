 // app/api/documents/search/route.ts

import { NextRequest, NextResponse } from "next/server";

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------
export type SupportedFileType = "pdf" | "docx" | "pptx" | "xlsx" | "image" | "all";

export interface DocumentSearchItem {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  courseId: string;
  courseTitle: string;
  lessonId?: string;
  lessonTitle?: string;
  isPublic: boolean;
  createdAt: string;
  score?: number; // Search relevance score
}

export interface SearchQueryParams {
  q: string;
  courseId?: string;
  lessonId?: string;
  fileType?: SupportedFileType;
  page: number;
  limit: number;
  sortBy: "relevance" | "createdAt" | "title" | "sizeBytes";
  sortOrder: "asc" | "desc";
}

interface UserSession {
  userId: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}

// ----------------------------------------------------------------------
// Mock Helper Functions (Replace with your actual Auth, DB & Search integrations)
// ----------------------------------------------------------------------

async function getAuthenticatedUser(req: NextRequest): Promise<UserSession | null> {
  const authHeader = req.headers.get("authorization");
  const sessionToken = req.cookies.get("session_token")?.value;

  if (!authHeader && !sessionToken) return null;

  // Replace with your NextAuth / Clerk / Kinde / Custom JWT verification
  return {
    userId: "usr_student_123",
    role: "STUDENT",
  };
}

/**
 * Returns list of course IDs the user is authorized to search within.
 */
async function getUserEnrolledCourseIds(userId: string): Promise<string[]> {
  // Replace with DB lookup: e.g., await db.enrollment.findMany({ where: { userId }, select: { courseId: true } })
  return ["course_99", "course_101"];
}

/**
 * Executes full-text search against Database (Prisma/PostgreSQL) or Search Engine (Algolia/Meilisearch).
 */
async function searchDocumentsInDb(
  params: SearchQueryParams,
  allowedCourseIds: string[] | null, // null means unrestricted (e.g. Admin)
  isStudent: boolean
): Promise<{ documents: DocumentSearchItem[]; total: number }> {
  // Example Prisma query logic structure:
  /*
  const whereClause: Prisma.DocumentWhereInput = {
    AND: [
      params.q ? {
        OR: [
          { title: { contains: params.q, mode: 'insensitive' } },
          { description: { contains: params.q, mode: 'insensitive' } },
          { fileName: { contains: params.q, mode: 'insensitive' } },
        ]
      } : {},
      params.courseId ? { courseId: params.courseId } : {},
      params.lessonId ? { lessonId: params.lessonId } : {},
      params.fileType && params.fileType !== 'all' ? getMimeTypeFilter(params.fileType) : {},
      isStudent ? {
        OR: [
          { isPublic: true },
          { courseId: { in: allowedCourseIds ?? [] } }
        ]
      } : {}
    ]
  };
  */

  // Mocked Search Results
  const mockDocuments: DocumentSearchItem[] = [
    {
      id: "doc_1",
      title: "React Server Components Architecture Guide",
      description: "Deep dive into hydration patterns and server-side component rendering.",
      fileName: "rsc_architecture_v2.pdf",
      fileKey: "courses/course_99/docs/rsc_architecture_v2.pdf",
      fileUrl: "https://storage.learnhub.com/courses/course_99/docs/rsc_architecture_v2.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3145728, // 3 MB
      courseId: "course_99",
      courseTitle: "Advanced Next.js Mastery",
      lessonId: "lesson_04",
      lessonTitle: "Server vs Client Components",
      isPublic: false,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      score: 0.95,
    },
    {
      id: "doc_2",
      title: "State Management Cheatsheet",
      description: "Comparison of Zustand, Redux Toolkit, and React Context.",
      fileName: "state_management_cheatsheet.pdf",
      fileKey: "courses/course_99/docs/state_management.pdf",
      fileUrl: "https://storage.learnhub.com/courses/course_99/docs/state_management.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1572864, // 1.5 MB
      courseId: "course_99",
      courseTitle: "Advanced Next.js Mastery",
      lessonId: "lesson_02",
      lessonTitle: "Client-Side State",
      isPublic: false,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      score: 0.82,
    },
  ];

  // Filter based on query query term if provided
  let filtered = mockDocuments;
  if (params.q.trim()) {
    const queryLower = params.q.toLowerCase();
    filtered = filtered.filter(
      (doc) =>
        doc.title.toLowerCase().includes(queryLower) ||
        doc.description?.toLowerCase().includes(queryLower) ||
        doc.fileName.toLowerCase().includes(queryLower)
    );
  }

  // Filter based on courseId if specified
  if (params.courseId) {
    filtered = filtered.filter((doc) => doc.courseId === params.courseId);
  }

  return {
    documents: filtered,
    total: filtered.length,
  };
}

// ----------------------------------------------------------------------
// GET /api/documents/search
// ----------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Extract and Sanitize Parameters
    const q = searchParams.get("q")?.trim() || "";
    const courseId = searchParams.get("courseId") || undefined;
    const lessonId = searchParams.get("lessonId") || undefined;
    const fileType = (searchParams.get("fileType") as SupportedFileType) || "all";
    
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const rawLimit = parseInt(searchParams.get("limit") || "10", 10);
    const limit = Math.min(Math.max(1, rawLimit), 50); // Clamp limit between 1 and 50

    const sortByParam = searchParams.get("sortBy") || "relevance";
    const sortBy = ["relevance", "createdAt", "title", "sizeBytes"].includes(sortByParam)
      ? (sortByParam as SearchQueryParams["sortBy"])
      : "relevance";

    const sortOrderParam = searchParams.get("sortOrder")?.toLowerCase() || "desc";
    const sortOrder: "asc" | "desc" = sortOrderParam === "asc" ? "asc" : "desc";

    // 2. Authentication Check
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required to search course documents." },
        { status: 401 }
      );
    }

    // 3. Determine Access Boundaries
    let allowedCourseIds: string[] | null = null;
    if (user.role === "STUDENT") {
      allowedCourseIds = await getUserEnrolledCourseIds(user.userId);
    }

    // 4. Construct Query State
    const queryParams: SearchQueryParams = {
      q,
      courseId,
      lessonId,
      fileType,
      page,
      limit,
      sortBy,
      sortOrder,
    };

    // 5. Execute Search Query
    const { documents, total } = await searchDocumentsInDb(
      queryParams,
      allowedCourseIds,
      user.role === "STUDENT"
    );

    // 6. Calculate Pagination Metadata
    const totalPages = Math.ceil(total / limit) || 1;
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // 7. Standardized Response Format
    return NextResponse.json(
      {
        success: true,
        data: documents,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
        filtersApplied: {
          q,
          courseId: courseId || null,
          lessonId: lessonId || null,
          fileType,
          sortBy,
          sortOrder,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DOCUMENT_SEARCH_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "An error occurred while processing your search." },
      { status: 500 }
    );
  }
}