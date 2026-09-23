 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper function to create URL-safe slugs
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ----------------------------------------------------------------------
// GET: Fetch Courses with Filtering, Search, Sorting, and Pagination
// Endpoint: /api/courses?search=nextjs&category=tech&level=BEGINNER&minPrice=0&maxPrice=100&sortBy=popular&page=1&limit=10
// ----------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Extract query parameters
    const search = searchParams.get("search");
    const categoryId = searchParams.get("categoryId");
    const categorySlug = searchParams.get("category");
    const level = searchParams.get("level"); // BEGINNER | INTERMEDIATE | ADVANCED | ALL_LEVELS
    const isFree = searchParams.get("isFree") === "true";
    const minPrice = searchParams.get("minPrice") ? parseFloat(searchParams.get("minPrice")!) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : undefined;
    const instructorId = searchParams.get("instructorId");
    const isPublished = searchParams.get("isPublished"); // Useful for instructor dashboards

    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = searchParams.get("sortBy") || "newest"; // newest | price_asc | price_desc | popular

    // Build dynamic Prisma filter
    const whereClause: any = {};

    // By default, public API only returns published courses unless instructor checks their own
    if (isPublished !== null && isPublished !== undefined) {
      whereClause.isPublished = isPublished === "true";
    } else {
      whereClause.isPublished = true;
    }

    if (instructorId) whereClause.instructorId = instructorId;
    if (categoryId) whereClause.categoryId = categoryId;
    if (categorySlug) whereClause.category = { slug: categorySlug };
    if (level) whereClause.level = level;

    // Search by title or description
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Price Filtering
    if (isFree) {
      whereClause.price = 0;
    } else if (minPrice !== undefined || maxPrice !== undefined) {
      whereClause.price = {};
      if (minPrice !== undefined) whereClause.price.gte = minPrice;
      if (maxPrice !== undefined) whereClause.price.lte = maxPrice;
    }

    // Sorting map
    let orderBy: any = { createdAt: "desc" };
    if (sortBy === "price_asc") orderBy = { price: "asc" };
    if (sortBy === "price_desc") orderBy = { price: "desc" };
    if (sortBy === "popular") orderBy = { enrollments: { _count: "desc" } };

    // Execute database queries in parallel
    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        include: {
          instructor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          enrollments: { select: { id: true } },
          reviews: { select: { rating: true } },
          chapters: {
            select: { id: true, isPublished: true },
          },
        },
      }),
      prisma.course.count({ where: whereClause }),
    ]);

    // Format output with computed average ratings and student totals
    const formattedCourses = courses.map((course) => {
      const totalReviews = course.reviews.length;
      const avgRating =
        totalReviews > 0
          ? Math.round(
              (course.reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews) * 10
            ) / 10
          : 0;

      return {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        imageUrl: course.imageUrl,
        price: course.price,
        level: course.level,
        isPublished: course.isPublished,
        category: course.category,
        instructor: course.instructor,
        studentCount: course.enrollments.length,
        chapterCount: course.chapters.length,
        rating: avgRating,
        reviewCount: totalReviews,
        createdAt: course.createdAt,
      };
    });

    return NextResponse.json(
      {
        courses: formattedCourses,
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
    console.error("[GET_COURSES_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch courses.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// POST: Create a New Course (Instructor / Admin Only)
// Endpoint: /api/courses
// ----------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      title,
      description,
      categoryId,
      instructorId,
      price = 0,
      level = "BEGINNER",
      imageUrl,
    } = body;

    // 1. Validation
    if (!title || !categoryId || !instructorId) {
      return NextResponse.json(
        { error: "Missing required fields: title, categoryId, instructorId." },
        { status: 400 }
      );
    }

    // 2. Verify instructor exists and has appropriate role
    const instructor = await prisma.user.findUnique({
      where: { id: instructorId },
      select: { id: true, role: true },
    });

    if (!instructor) {
      return NextResponse.json(
        { error: "Instructor user record not found." },
        { status: 404 }
      );
    }

    if (instructor.role !== "INSTRUCTOR" && instructor.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: User does not have teaching permissions." },
        { status: 403 }
      );
    }

    // 3. Generate unique slug
    let baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;

    while (await prisma.course.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // 4. Create new Course draft
    const newCourse = await prisma.course.create({
      data: {
        title,
        slug,
        description: description || "",
        categoryId,
        instructorId,
        price: parseFloat(price.toString()),
        level,
        imageUrl: imageUrl || null,
        isPublished: false, // New courses start as draft
      },
      include: {
        category: { select: { name: true, slug: true } },
        instructor: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(
      {
        message: "Course created successfully as draft.",
        course: newCourse,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_COURSE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create course.", details: error.message },
      { status: 500 }
    );
  }
}