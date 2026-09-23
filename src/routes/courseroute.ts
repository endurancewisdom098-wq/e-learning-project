import { Router } from 'express';
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/coursecontroller';
import { verifyToken } from '../middleware/expressAuth';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

/**
 * @route   GET /api/v1/courses
 * @desc    Get all published courses (Publicly accessible)
 * @access  Public
 */
router.get('/', getAllCourses);

/**
 * @route   GET /api/v1/courses/:id
 * @desc    Get detailed course info including modules/lessons
 * @access  Public / Enrolled Students
 */
router.get('/:id', getCourseById);

/**
 * @route   POST /api/v1/courses
 * @desc    Create a new course
 * @access  Private (Instructors & Admins only)
 */
router.post('/', verifyToken, requireRole(['instructor', 'admin']), createCourse);

/**
 * @route   PUT /api/v1/courses/:id
 * @desc    Update course details
 * @access  Private (Instructors & Admins only)
 */
router.put('/:id', verifyToken, requireRole(['instructor', 'admin']), updateCourse);

/**
 * @route   DELETE /api/v1/courses/:id
 * @desc    Delete a course
 * @access  Private (Instructors & Admins only)
 */
router.delete('/:id', verifyToken, requireRole(['instructor', 'admin']), deleteCourse);

export default router;