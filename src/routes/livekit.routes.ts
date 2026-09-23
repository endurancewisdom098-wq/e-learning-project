 import { Router, Request, Response } from 'express';
import express from 'express';
import { livekitService } from '../srevices/livekit.service';
import { verifyToken } from '../middleware/expressAuth';

const router = Router();

/**
 * @route   POST /api/live/token
 * @desc    Generate a LiveKit join token for an authenticated user
 * @access  Private
 */
router.get('/token', verifyToken, async (req: Request, res: Response) => {
  try {
    const { roomName, isHost } = req.body;
    const identity = req.user?.userId;
    const name = req.user?.email || identity;

    if (!roomName) {
      return res.status(400).json({ error: 'roomName is required' });
    }

    if (!identity) {
      return res.status(401).json({ error: 'User identity missing from token' });
    }

    const token = await livekitService.createToken({
      roomName,
      identity,
      name,
      isAdmin: Boolean(isHost),
    });

    return res.status(200).json({ token });
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate token' });
  }
});

/**
 * @route   POST /api/live/rooms
 * @desc    Create a new live room / stream session
 * @access  Private
 */
router.get('/rooms', verifyToken, async (req: Request, res: Response) => {
  try {
    const { roomName, maxParticipants, emptyTimeout, metadata } = req.body;

    if (!roomName) {
      return res.status(400).json({ error: 'roomName is required' });
    }

    const room = await livekitService.createRoom({
      name: roomName,
      maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
      emptyTimeout: emptyTimeout ? Number(emptyTimeout) : undefined,
      metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata,
    });

    return res.status(201).json({ room });
  } catch (error: any) {
    console.error('Error creating room:', error);
    return res.status(500).json({ error: error.message || 'Failed to create room' });
  }
});

/**
 * @route   GET /api/live/rooms
 * @desc    List all active live streams / rooms
 * @access  Public
 */
router.get('/rooms', async (_req: Request, res: Response) => {
  try {
    const rooms = await livekitService.listRooms();
    return res.status(200).json({ rooms });
  } catch (error: any) {
    console.error('Error listing rooms:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch rooms' });
  }
});

/**
 * @route   GET /api/live/rooms/:roomName/participants
 * @desc    Get active participants in a specific room
 * @access  Private
 */
router.get('/rooms/:roomName/participants', verifyToken, async (req: Request, res: Response) => {
  try {
    const roomName = String(req.params.roomName);
    const participants = await livekitService.listParticipants(roomName);
    return res.status(200).json({ participants });
  } catch (error: any) {
    console.error('Error fetching participants:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch participants' });
  }
});

/**
 * @route   POST /api/live/rooms/:roomName/mute
 * @desc    Mute or unmute a participant's audio/video track
 * @access  Private (Host/Admin)
 */
router.post('/rooms/:roomName/mute', verifyToken, async (req: Request, res: Response) => {
  try {
    const roomName = String(req.params.roomName);
    const { identity, trackSid, muted } = req.body;

    if (!identity || !trackSid || typeof muted !== 'boolean') {
      return res.status(400).json({ error: 'identity, trackSid, and muted (boolean) are required' });
    }

    const track = await livekitService.mutePublishedTrack(roomName, identity, trackSid, muted);
    return res.status(200).json({ track });
  } catch (error: any) {
    console.error('Error muting track:', error);
    return res.status(500).json({ error: error.message || 'Failed to mute track' });
  }
});

/**
 * @route   DELETE /api/live/rooms/:roomName/participants/:identity
 * @desc    Kick a participant from a room
 * @access  Private (Host/Admin)
 */
router.delete('/rooms/:roomName/participants/:identity', verifyToken, async (req: Request, res: Response) => {
  try {
    const roomName = String(req.params.roomName);
    const identity = String(req.params.identity);
    await livekitService.removeParticipant(roomName, identity);
    return res.status(200).json({ message: `Participant ${identity} removed from ${roomName}` });
  } catch (error: any) {
    console.error('Error removing participant:', error);
    return res.status(500).json({ error: error.message || 'Failed to remove participant' });
  }
});

/**
 * @route   DELETE /api/live/rooms/:roomName
 * @desc    Close/End a live stream room
 * @access  Private (Host/Admin)
 */
router.delete('/rooms/:roomName', verifyToken, async (req: Request, res: Response) => {
  try {
    const roomName = String(req.params.roomName);
    await livekitService.deleteRoom(roomName);
    return res.status(200).json({ message: `Room ${roomName} closed successfully` });
  } catch (error: any) {
    console.error('Error closing room:', error);
    return res.status(500).json({ error: error.message || 'Failed to close room' });
  }
});

/**
 * @route   POST /api/live/webhook
 * @desc    Handle server-side webhook events from LiveKit cloud/instance
 * @access  Public (Signature validated via WebhookReceiver)
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/webhook+json' }),
  async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send('Unauthorized: Missing authorization header');
      }

      const event = await livekitService.validateWebhook(req.body, authHeader);
      console.log('LiveKit Webhook Event received:', event.event);

      switch (event.event) {
        case 'room_started':
          // Perform DB update or state tracking when room starts
          break;
        case 'room_finished':
          // Perform DB update when room ends
          break;
        case 'participant_joined':
          // Track active participant metrics
          break;
        case 'participant_left':
          // Cleanup session state
          break;
      }

      return res.status(200).send('OK');
    } catch (error: any) {
      console.error('LiveKit Webhook Verification Error:', error);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
);

export default router;