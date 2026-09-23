 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_ROLES = ["STUDENT", "INSTRUCTOR", "ADMIN"];

// ----------------------------------------------------------------------
// GET: Fetch Individual User Profile & Activity Summary
// Endpoint: /api/users/[id]
// Supports lookup by Database User ID or External Auth ID
// ----------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Search by primary ID or external auth provider ID (e.g. Clerk/Auth0 ID)
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: id }, { externalId: id }],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        bio: true,
        externalId: true,
        createdAt: true,
        updatedAt: true,
        // Include courses student is enrolled in
        enrollments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            createdAt: true,
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                imageUrl: true,
                price: true,
                category: {
                  select: { name: true },
                },
              },
            },
          },
        },
        // Include courses created if the user is an instructor
        createdCourses: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            price: true,
            isPublished: true,
            createdAt: true,
            _count: {
              select: {
                enrollments: true,
              },
            },
          },
        },
        // Aggregate totals for stats overview
        _count: {
          select: {
            enrollments: true,
            createdCourses: true,
            payments: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error: any) {
    console.error("[GET_USER_BY_ID_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// PATCH: Update Profile Details, Bio, Avatar, or Role
// Endpoint: /api/users/[id]
// ----------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { firstName, lastName, bio, avatarUrl, role, email } = body;

    // 1. Locate user by ID or externalId
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ id: id }, { externalId: id }],
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    // 2. Validate role update if provided
    if (role) {
      const normalizedRole = role.toUpperCase();
      if (!VALID_ROLES.includes(normalizedRole)) {
        return NextResponse.json(
          { error: `Invalid role. Allowed values: ${VALID_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // 3. Prevent duplicate email collision if updating email
    if (email && email.toLowerCase() !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (emailTaken) {
        return NextResponse.json(
          { error: "Email address is already in use by another account." },
          { status: 409 }
        );
      }
    }

    // 4. Update user record
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(email && { email: email.toLowerCase() }),
        ...(role && { role: role.toUpperCase() }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        bio: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "User profile updated successfully.",
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[UPDATE_USER_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update user account.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// DELETE: Remove User Account & Associated Data
// Endpoint: /api/users/[id]
// ----------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 1. Check user existence
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ id: id }, { externalId: id }],
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    // 2. Delete user account
    await prisma.user.delete({
      where: { id: existingUser.id },
    });

    return NextResponse.json(
      { message: "User account deleted successfully." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[DELETE_USER_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete user account.", details: error.message },
      { status: 500 }
    );
  }
}