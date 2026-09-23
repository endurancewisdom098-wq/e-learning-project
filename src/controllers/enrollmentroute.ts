import { Request, Response } from 'express';
// Assuming you have an Enrollment and Course model set up
// import Enrollment from '../models/Enrollment';
// import Course from '../models/Course';

/**
 * Enroll a student in a course
 * @route POST /api/v1/enrollments
 */
export const enrollCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.body;
    // @ts-ignore - Assuming auth middleware attaches user info to req.user
    const studentId = req.user?.id;

    if (!courseId) {
      res.status(400).json({ success: false, error: 'Course ID is required' });
      return;
    }

    // Check if already enrolled
    // const existingEnrollment = await Enrollment.findOne({ student: studentId, course: courseId });
    // if (existingEnrollment) {
    //   res.status(400).json({ success: false, error: 'Already enrolled in this course' });
    //   return;
    // }

    // Create enrollment record (can also integrate payment gateway verification here)
    // const newEnrollment = await Enrollment.create({ student: studentId, course: courseId, status: 'active' });

    res.status(201).json({
      success: true,
      message: 'Successfully enrolled in the course',
      enrollment: { courseId, studentId, enrolledAt: new Date() },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process enrollment' });
  }
};

/**
 * Get all courses the logged-in student is enrolled in
 * @route GET /api/v1/enrollments/my-courses
 */
export const getMyEnrollments = async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore
    const studentId = req.user?.id;

    // const enrollments = await Enrollment.find({ student: studentId }).populate('course');

    res.status(200).json({
      success: true,
      count: 0,
      enrollments: [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch student enrollments' });
  }
};

/**
 * Check if the logged-in user is enrolled in a specific course
 * @route GET /api/v1/enrollments/check/:courseId
 */
export const checkEnrollmentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    // @ts-ignore
    const studentId = req.user?.id;

    // const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
    const isEnrolled = false; // Mock result

    res.status(200).json({
      success: true,
      isEnrolled,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check enrollment status' });
  }
};