import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import {
  createLesson,
  getLessonsByCourse,
  getLessonById,
  updateLesson,
  deleteLesson,
} from '../controllers/lessoncontroller';
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
const instructorOrAdmin: RequestHandler = requireRole(['INSTRUCTOR', 'ADMIN']) as RequestHandler;

router.get('/course/:courseId', verifyToken, getLessonsByCourse);
router.get('/:id', verifyToken, getLessonById);
router.post('/', verifyToken, instructorOrAdmin, createLesson);
router.put('/:id', verifyToken, instructorOrAdmin, updateLesson);
router.delete('/:id', verifyToken, instructorOrAdmin, deleteLesson);

export default router;