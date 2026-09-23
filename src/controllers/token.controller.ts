import { Request, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';

/**
 * Controller to generate a LiveKit room access token
 * Endpoint: GET /api/token?room=lecture-hall-101
 * Protected: Requires authMiddleware
 */
export const generateToken = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const room = req.query.room as string;

    // 1. Ensure room parameter is provided
    if (!room) {
      return res.status(400).json({ error: 'Missing required query parameter: room' });
    }

    // 2. Extract identity securely from authenticated session
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User session missing' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing from .env');
      return res.status(500).json({ error: 'Server credentials configuration error' });
    }

    // 3. Create LiveKit token using verified user credentials
    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: userEmail,
    });

    token.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();

    return res.status(200).json({ token: jwt });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return res.status(500).json({ error: 'Failed to generate classroom access token' });
  }
};