 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Helper function to generate a unique certificate code (e.g., CERT-2026-A1B2C3D4)
function generateCertificateCode(): string {
  const year = new Date().getFullYear();
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `CERT-${year}-${randomHex}`;
}

// ----------------------------------------------------------------------
// GET: Fetch Certificates (Supports filtering by userId, courseId, or search)
// Endpoint: /api/certificates?userId=xxx&courseId=yyy&search=zzz&page=1&limit=10
// ----------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const courseId = searchParams.get("courseId");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // Build Prisma query filters
    const whereClause: any = {
      isRevoked: false,
    };

    if (userId) whereClause.userId = userId;
    if (courseId) whereClause.courseId = courseId;
    if (search) {
      whereClause.OR = [
        { certificateCode: { contains: search, mode: "insensitive" } },
        { user: { firstName: { contains: search, mode: "insensitive" } } },
        { user: { lastName: { contains: search, mode: "insensitive" } } },
        { course: { title: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Execute queries in parallel for efficiency
    const [certificates, total] = await Promise.all([
      prisma.certificate.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { issueDate: "desc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              imageUrl: true,
            },
          },
        },
      }),
      prisma.certificate.count({ where: whereClause }),
    ]);

    return NextResponse.json(
      {
        certificates,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GET_CERTIFICATES_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch certificates.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// POST: Issue/Generate a New Certificate for a Student
// Endpoint: /api/certificates
// ----------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, courseId, pdfUrl } = body;

    // 1. Input Validation
    if (!userId || !courseId) {
      return NextResponse.json(
        { error: "Both 'userId' and 'courseId' are required." },
        { status: 400 }
      );
    }

    // 2. Verify User and Course exist
    const [user, course] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    // 3. Check for existing certificate to prevent duplicates
    const existingCertificate = await prisma.certificate.findFirst({
      where: { userId, courseId, isRevoked: false },
    });

    if (existingCertificate) {
      return NextResponse.json(
        {
          message: "Certificate already issued for this user and course.",
          certificate: existingCertificate,
        },
        { status: 200 }
      );
    }

    // 4. Verify Course Progress / Completion
    // Check total lessons vs completed progress records
    const [totalLessons, completedLessons] = await Promise.all([
      prisma.lesson.count({
        where: { chapter: { courseId } },
      }),
      prisma.userProgress.count({
        where: {
          userId,
          isCompleted: true,
          lesson: { chapter: { courseId } },
        },
      }),
    ]);

    if (totalLessons === 0 || completedLessons < totalLessons) {
      return NextResponse.json(
        {
          error: "Course is not 100% completed.",
          progress: {
            completedLessons,
            totalLessons,
            percentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
          },
        },
        { status: 400 }
      );
    }

    // 5. Generate unique code and create record
    let certificateCode = generateCertificateCode();

    // Ensure code collision safety
    let codeExists = await prisma.certificate.findUnique({ where: { certificateCode } });
    while (codeExists) {
      certificateCode = generateCertificateCode();
      codeExists = await prisma.certificate.findUnique({ where: { certificateCode } });
    }

    const newCertificate = await prisma.certificate.create({
      data: {
        certificateCode,
        userId,
        courseId,
        pdfUrl: pdfUrl || null,
        issueDate: new Date(),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        course: { select: { title: true } },
      },
    });

    return NextResponse.json(
      {
        message: "Certificate issued successfully.",
        certificate: newCertificate,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[ISSUE_CERTIFICATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to issue certificate.", details: error.message },
      { status: 500 }
    );
  }
}