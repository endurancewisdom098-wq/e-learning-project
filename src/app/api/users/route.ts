 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Supported user roles
const VALID_ROLES = ["STUDENT", "INSTRUCTOR", "ADMIN"];

// ----------------------------------------------------------------------
// GET: Fetch Users (Filtered by role, search query, with pagination)
// Endpoint: /api/users?role=STUDENT&search=john&page=1&limit=10
// ----------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const role = searchParams.get("role");
    const search = searchParams.get("search");

    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // Filter conditions
    const whereClause: any = {};

    if (role) {
      if (!VALID_ROLES.includes(role.toUpperCase())) {
        return NextResponse.json(
          {
            error: `Invalid role parameter. Allowed values: ${VALID_ROLES.join(
              ", "
            )}`,
          },
          { status: 400 }
        );
      }
      whereClause.role = role.toUpperCase();
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // Execute paginated search & total count
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              enrollments: true,
              createdCourses: true,
            },
          },
        },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    return NextResponse.json(
      {
        users,
        meta: {
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GET_USERS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch users.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// POST: Register / Create User Record
// Endpoint: /api/users
// ----------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      email,
      firstName,
      lastName,
      role = "STUDENT",
      avatarUrl,
      externalId, // Optional ID from auth provider (e.g. Clerk, Auth0, Firebase)
    } = body;

    // 1. Basic validation
    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: 'email', 'firstName', and 'lastName' are required.",
        },
        { status: 400 }
      );
    }

    const normalizedRole = role.toUpperCase();
    if (!VALID_ROLES.includes(normalizedRole)) {
      return NextResponse.json(
        {
          error: `Invalid role. Allowed values: ${VALID_ROLES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 2. Prevent duplicates by email or external ID
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          ...(externalId ? [{ externalId }] : []),
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email or external ID already exists." },
        { status: 409 }
      );
    }

    // 3. Create user entry
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName,
        lastName,
        role: normalizedRole,
        avatarUrl: avatarUrl || null,
        ...(externalId && { externalId }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "User created successfully.",
        user: newUser,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_USER_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create user.", details: error.message },
      { status: 500 }
    );
  }
}