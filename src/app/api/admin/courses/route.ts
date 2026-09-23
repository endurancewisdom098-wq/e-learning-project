import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  assertRolePermission,
  UnauthorizedError,
  ForbiddenError,
  type SubjectUser,
} from "@/lib/permissions";

const prismaAny = prisma as any;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const user: SubjectUser = {
      id: session.user.id,
      role: session.user.role as SubjectUser["role"],
    };

    assertRolePermission(user, "analytics:view_global");

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status") || "ALL";

    let whereClause = "";
    if (search) {
      whereClause = `WHERE title LIKE '%${search.replace(/'/g, "''")}%'
        OR code LIKE '%${search.replace(/'/g, "''")}%'
        OR instructor LIKE '%${search.replace(/'/g, "''")}%'`;
    }

    if (status === "PUBLISHED") {
      whereClause = whereClause ? `${whereClause} AND id IS NOT NULL` : "WHERE id IS NOT NULL";
    }

    const courses = await prismaAny.$queryRawUnsafe(`
      SELECT c.*
      FROM Course c
      ${whereClause}
      ORDER BY c.id DESC
    `);

    const formattedCourses = await Promise.all(
      courses.map(async (course: any) => {
        const [studentCountRow] = await prismaAny.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM Enrollment WHERE courseId = ?`,
          [course.id]
        );

        return {
          id: course.id,
          code: course.code,
          title: course.title,
          instructor: course.instructor,
          thumbnail: course.thumbnail,
          totalStudents: Number(studentCountRow?.count ?? 0),
          createdAt: course.createdAt ? new Date(course.createdAt).toISOString() : null,
        };
      })
    );

    return NextResponse.json({ courses: formattedCourses }, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Admin courses GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const user: SubjectUser = {
      id: session.user.id,
      role: session.user.role as SubjectUser["role"],
    };

    assertRolePermission(user, "course:create");

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : `COURSE-${Date.now()}`;
    const instructor = typeof body.instructor === "string" ? body.instructor.trim() : "System";
    const thumbnail = typeof body.thumbnail === "string" ? body.thumbnail.trim() : null;

    if (!title) {
      return NextResponse.json({ error: "Course title is required." }, { status: 400 });
    }

    const inserted = await prismaAny.$queryRawUnsafe(
      `
        INSERT INTO Course (id, code, title, instructor, thumbnail)
        VALUES (?, ?, ?, ?, ?)
      `,
      [crypto.randomUUID(), code, title, instructor, thumbnail]
    );

    return NextResponse.json({ success: true, inserted }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Admin courses POST error:", error);
    return NextResponse.json({ error: "Failed to create course." }, { status: 500 });
  }
}