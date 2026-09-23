 import { UserRole } from "@/auth";
import prisma from "@/lib/prisma";

// ----------------------------------------------------------------------
// 1. Core Permission Definitions & Types
// ----------------------------------------------------------------------

// lib/permissions.ts

export type Role = "ADMIN" | "INSTRUCTOR" | "STUDENT";

export const PERMISSIONS = {
  MANAGE_USERS: ["ADMIN"],
  CREATE_COURSE: ["ADMIN", "INSTRUCTOR"],
  DELETE_COURSE: ["ADMIN"],
  WATCH_LESSON: ["ADMIN", "INSTRUCTOR", "STUDENT"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
export type Action =
  | "course:create"
  | "course:read"
  | "course:edit"
  | "course:delete"
  | "course:publish"
  | "lesson:read"
  | "lesson:manage"
  | "analytics:view_own"
  | "analytics:view_global"
  | "user:manage"
  | "review:create"
  | "review:delete";

export interface SubjectUser {
  id: string;
  role: UserRole;
}

// Static Role-Based Access Control Matrix (RBAC)
const ROLE_PERMISSIONS: Record<UserRole, Set<Action>> = {
  ADMIN: new Set<Action>([
    "course:create",
    "course:read",
    "course:edit",
    "course:delete",
    "course:publish",
    "lesson:read",
    "lesson:manage",
    "analytics:view_own",
    "analytics:view_global",
    "user:manage",
    "review:create",
    "review:delete",
  ]),
  INSTRUCTOR: new Set<Action>([
    "course:create",
    "course:read",
    "course:edit",
    "course:delete",
    "course:publish",
    "lesson:read",
    "lesson:manage",
    "analytics:view_own",
    "review:create",
    "review:delete",
  ]),
  STUDENT: new Set<Action>([
    "course:read",
    "lesson:read",
    "review:create",
  ]),
};

// Custom Error Classes for Clean API & Server Action Handling
export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ----------------------------------------------------------------------
// 2. Pure RBAC Permission Checker
// ----------------------------------------------------------------------

/**
 * Checks if a given role possesses a static permission action.
 */
export function hasRolePermission(role: UserRole, action: Action): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

// ----------------------------------------------------------------------
// 3. Fine-Grained Dynamic ABAC (Attribute-Based) Authorization
// ----------------------------------------------------------------------

/**
 * Validates whether a user can read/stream a specific course or lesson content.
 * Allowed if: User is ADMIN, OR Course Instructor, OR Active Enrolled Student.
 */
export async function canAccessCourse(
  user: SubjectUser | null | undefined,
  courseId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true, isPublished: true, deletedAt: true },
  });

  if (!course || course.deletedAt) return false;

  // Instructor who owns the course has full access regardless of publication status
  if (user.role === "INSTRUCTOR" && course.instructorId === user.id) {
    return true;
  }

  // Unpublished courses are restricted to owner/admin
  if (!course.isPublished) return false;

  // Check active student enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId,
      },
    },
  });

  return Boolean(enrollment);
}

/**
 * Validates whether a user can modify or delete a course.
 * Allowed if: User is ADMIN, OR the primary INSTRUCTOR who created the course.
 */
export async function canManageCourse(
  user: SubjectUser | null | undefined,
  courseId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role !== "INSTRUCTOR") return false;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true },
  });

  return Boolean(course && course.instructorId === user.id);
}

/**
 * Validates whether a student can view a specific lesson based on prerequisite rules.
 */
export async function canAccessLesson(
  user: SubjectUser | null | undefined,
  lessonId: string
): Promise<boolean> {
  if (!user) return false;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      isFreePreview: true,
      chapter: {
        select: {
          courseId: true,
          course: { select: { instructorId: true, isPublished: true } },
        },
      },
    },
  });

  if (!lesson) return false;

  const { courseId, course } = lesson.chapter;

  if (user.role === "ADMIN") return true;
  if (user.role === "INSTRUCTOR" && course.instructorId === user.id) return true;

  // Allow free preview lessons on published courses without enrollment
  if (lesson.isFreePreview && course.isPublished) return true;

  // Check if enrolled
  return canAccessCourse(user, courseId);
}

// ----------------------------------------------------------------------
// 4. Assertion Helpers (Throws Errors for Direct Use in API/Actions)
// ----------------------------------------------------------------------

/**
 * Asserts static role capability or throws a ForbiddenError.
 */
export function assertRolePermission(user: SubjectUser | null | undefined, action: Action) {
  if (!user) throw new UnauthorizedError();
  if (!hasRolePermission(user.role, action)) {
    throw new ForbiddenError(`Role ${user.role} is not permitted to execute action: ${action}`);
  }
}

/**
 * Asserts dynamic course management access or throws a ForbiddenError.
 */
export async function assertCanManageCourse(user: SubjectUser | null | undefined, courseId: string) {
  if (!user) throw new UnauthorizedError();
  const allowed = await canManageCourse(user, courseId);
  if (!allowed) {
    throw new ForbiddenError("You do not have administrative ownership over this course.");
  }
}

/**
 * Asserts dynamic course access or throws a ForbiddenError.
 */
export async function assertCanAccessCourse(user: SubjectUser | null | undefined, courseId: string) {
  if (!user) throw new UnauthorizedError();
  const allowed = await canAccessCourse(user, courseId);
  if (!allowed) {
    throw new ForbiddenError("You are not enrolled in this course.");
  }
}