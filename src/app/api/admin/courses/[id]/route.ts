 import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  assertRolePermission,
  assertCanManageCourse,
  UnauthorizedError,
  ForbiddenError,
  SubjectUser,
} from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const user: SubjectUser = { id: session.user.id, role: session.user.role as SubjectUser["role"] };

    // Dynamic dynamic ownership / access assertion
    await assertCanManageCourse(user, id);

    const body = await req.json();
    const updatedCourse = await prisma.course.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: parseFloat(body.price) }),
        ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      },
    });

    return NextResponse.json({ course: updatedCourse }, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: "Failed to update course." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const user: SubjectUser = { id: session.user.id, role: session.user.role as SubjectUser["role"] };

    // Role level check for deletion capability
    assertRolePermission(user, "course:delete");

    await prisma.course.delete({ where: { id } });

    return NextResponse.json({ message: "Course deleted." }, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: "Failed to delete course." }, { status: 500 });
  }
}