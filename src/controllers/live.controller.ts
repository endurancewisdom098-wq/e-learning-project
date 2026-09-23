 import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// Interface defining the expected payload inside your JWT
export interface JwtPayload {
  userId: string;
  email?: string;
  role?: string;
}

// Extend Express Request interface to attach user data
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware to verify JWT token from the Authorization header.
 * Usage: app.get('/protected', authenticateToken, (req, res) => { ... })
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <TOKEN>"

  if (!token) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token.' });
    return;
  }
};

/**
 * Optional middleware builder for role-based access control (RBAC).
 * Usage: app.get('/admin', authenticateToken, requireRole(['admin']), handler)
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.role) {
      res.status(403).json({ error: 'Forbidden. User role missing.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
      return;
    }

    next();
  };
};