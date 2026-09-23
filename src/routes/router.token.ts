import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { generateToken } from '../controllers/token.controller';
import { verifyJwtToken } from '../lib/auth';

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

router.get('/token', verifyToken, generateToken);

export default router;