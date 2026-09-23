import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory to check if the authenticated user has one of the allowed roles.
 * @param allowedRoles Array of roles permitted to access the route (e.g., ['admin', 'instructor'])
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({ success: false, error: 'Authentication required. No user context found.' });
        return;
      }

      // Check if user's role is included in the allowed roles list
      if (!user.role || !allowedRoles.some((role) => role.toUpperCase() === user.role?.toUpperCase())) {
        res.status(403).json({
          success: false,
          error: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`,
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ success: false, error: 'Internal server error during role validation' });
    }
  };
};

/**
 * Convenience middleware specifically for Super Admin checks
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const user = req.user;

    if (!user || user.role !== 'super_admin') {
      res.status(403).json({ success: false, error: 'Access denied. Super Admin privileges required.' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error during super admin validation' });
  }
};

/**
 * Middleware factory to check for specific fine-grained permissions (e.g., 'edit_orders')
 */
export const requirePermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({ success: false, error: 'Authentication required.' });
        return;
      }

      // Super admins bypass specific permission checks
      if (user.role === 'super_admin') {
        return next();
      }

      const permissions = (user as typeof user & { permissions?: string[] }).permissions;
      const hasPermission = permissions?.includes(requiredPermission);

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          error: `Access denied. Missing required permission: ${requiredPermission}`,
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ success: false, error: 'Internal server error during permission validation' });
    }
  };
};