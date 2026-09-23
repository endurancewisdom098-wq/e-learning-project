import { NextFunction, Request, Response, Router } from 'express';
import { getAdmins, createAdmin, deleteAdmin } from '../controllers/admincontroller';
import { verifyJwtToken } from '../lib/auth';

type AuthenticatedRequest = Request & {
	user?: {
		role?: string;
	};
};

async function verifyToken(
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
): Promise<void> {
	const authorization = req.headers.authorization;
	const bearerToken = authorization?.startsWith('Bearer ')
		? authorization.slice('Bearer '.length)
		: undefined;
	const token = bearerToken ?? req.cookies?.token;

	if (!token) {
		res.status(401).json({ error: 'Authentication required' });
		return;
	}

	const payload = await verifyJwtToken(token);
	if (!payload) {
		res.status(401).json({ error: 'Invalid or expired token' });
		return;
	}

	req.user = {
		userId: String(payload.userId ?? payload.sub ?? ''),
		role: typeof payload.role === 'string' ? payload.role : undefined,
	};
	next();
}

function requireSuperAdmin(
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
): void {
	if (req.user?.role?.toUpperCase() !== 'SUPER_ADMIN') {
		res.status(403).json({ error: 'Super admin access required' });
		return;
	}

	next();
}

const router = Router();

router.get('/admins', verifyToken, requireSuperAdmin, getAdmins);
router.post('/admins', verifyToken, requireSuperAdmin, createAdmin);
router.delete('/admins/:id', verifyToken, requireSuperAdmin, deleteAdmin);

export default router;