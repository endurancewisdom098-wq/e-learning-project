import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import {
  enrollCourse,
  getMyEnrollments,
  checkEnrollmentStatus,
} from '../controllers/enrollmentroute';
import { verifyJwtToken } from '../lib/auth';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();
const verifyToken: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined;

  if (!token) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  const payload = await verifyJwtToken(token);
  if (!payload?.userId) {
    res.status(403).json({ error: 'Invalid or expired token.' });
    return;
  }

  req.user = {
    userId: String(payload.userId),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    role: typeof payload.role === 'string' ? payload.role.toUpperCase() : undefined,
  };
  next();
};
const studentOnly: RequestHandler = requireRole(['STUDENT']) as RequestHandler;

/**
 * @route   POST /api/v1/enrollments
 * @desc    Enroll authenticated student in a course
 * @access  Private (Students only)
 */
router.post('/', verifyToken, studentOnly, enrollCourse);

/**
 * @route   GET /api/v1/enrollments/my-courses
 * @desc    Get all active course enrollments for the logged-in student
 * @access  Private (Students only)
 */
router.get('/my-courses', verifyToken, studentOnly, getMyEnrollments);

/**
 * @route   GET /api/v1/enrollments/check/:courseId
 * @desc    Check enrollment verification status for a specific course
 * @access  Private
 */
router.get('/check/:courseId', verifyToken, checkEnrollmentStatus);

export default router;