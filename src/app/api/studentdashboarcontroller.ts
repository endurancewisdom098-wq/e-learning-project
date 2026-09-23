export {};

 const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/student/dashboard
async function getStudentDashboard(req, res) {
  try {
    const studentId = req.user?.id || req.query.studentId;

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    // Parallel Database Queries
    const [
      student,
      enrollments,
      pendingSubmissions,
      attendanceRecords,
      recentGrades,
      announcements,
      notifications
    ] = await Promise.all([
      // 1. Student Profile
      prisma.student.findUnique({ where: { id: studentId } }),

      // 2. Active Enrolled Courses
      prisma.enrollment.findMany({
        where: { studentId, status: 'ACTIVE' },
        include: { course: true },
      }),

      // 3. Upcoming Assignments / Deadlines
      prisma.submission.findMany({
        where: {
          studentId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          assignment: { dueDate: { gte: new Date() } },
        },
        include: { assignment: { include: { course: true } } },
        orderBy: { assignment: { dueDate: 'asc' } },
        take: 5,
      }),

      // 4. Attendance Records
      prisma.attendance.findMany({ where: { studentId } }),

      // 5. Recent Grades (for Grade Trends)
      prisma.submission.findMany({
        where: { studentId, status: 'GRADED' },
        include: { assignment: { include: { course: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 6,
      }),

      // 6. Recent Course Announcements
      prisma.announcement.findMany({
        where: {
          course: { enrollments: { some: { studentId, status: 'ACTIVE' } } },
        },
        include: { course: true },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),

      // 7. Unread Notifications
      prisma.notification.count({ where: { studentId, isRead: false } }),
    ]);

    // Calculate Attendance Rate %
    const totalAttendance = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(a => a.status === 'PRESENT').length;
    const attendancePercentage = totalAttendance > 0 
      ? Math.round((presentCount / totalAttendance) * 100) 
      : 100;

    // Structure Dashboard Payload
    const dashboardData = {
      profile: {
        name: student?.name,
        avatarUrl: student?.avatarUrl,
        unreadNotificationsCount: notifications,
      },
      metrics: {
        activeCoursesCount: enrollments.length,
        currentGPA: student?.gpa || 0.0,
        assignmentsDueCount: pendingSubmissions.length,
        attendancePercentage: attendancePercentage,
      },
      continueLearning: enrollments.map(e => ({
        courseId: e.course.id,
        courseCode: e.course.code,
        title: e.course.title,
        instructor: e.course.instructor,
        progress: e.progress,
        lastModule: e.lastModule || 'Module 1: Introduction',
      })),
      upcomingDeadlines: pendingSubmissions.map(s => ({
        id: s.id,
        title: s.assignment.title,
        courseCode: s.assignment.course.code,
        dueDate: s.assignment.dueDate,
        maxPoints: s.assignment.maxPoints,
      })),
      gradeTrends: recentGrades.map(g => ({
        title: g.assignment.title,
        courseCode: g.assignment.course.code,
        score: g.score,
        maxPoints: g.assignment.maxPoints,
        percentage: Math.round(((g.score || 0) / g.assignment.maxPoints) * 100),
      })),
      announcements: announcements.map(a => ({
        id: a.id,
        title: a.title,
        content: a.content,
        courseCode: a.course.code,
        createdAt: a.createdAt,
      })),
    };

    return res.status(200).json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getStudentDashboard };