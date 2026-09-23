 import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const livekitHost = process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880';

if (!apiKey || !apiSecret) {
  throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET environment variables must be defined.');
}

// 1. Room Service Client (Admin tasks: list rooms, delete rooms, mute participants)
export const roomServiceClient = new RoomServiceClient(livekitHost, apiKey, apiSecret);

// 2. Webhook Receiver (Validates signatures of LiveKit event webhooks)
export const webhookReceiver = new WebhookReceiver(apiKey, apiSecret);

export interface TokenOptions {
  roomName: string;
  identity: string;
  name?: string;
  metadata?: string;
  isAdmin?: boolean;
}

/**
 * Generates a signed JWT access token for a user to join a room.
 */
export async function generateParticipantToken(options: TokenOptions): Promise<string> {
  const { roomName, identity, name, metadata, isAdmin = false } = options;

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: name || identity,
    metadata,
    ttl: '6h', // Token validity duration
  });

  // Assign room permissions (grants)
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: isAdmin,
    roomCreate: isAdmin,
  });

  return await at.toJwt();
}

/**
 * Express handler to generate and return tokens to clients.
 */
export async function tokenEndpointHandler(req: any, res: any) {
  try {
    const { roomName, identity, name } = req.body;

    if (!roomName || !identity) {
      return res.status(400).json({ error: 'roomName and identity are required' });
    }

    const token = await generateParticipantToken({ roomName, identity, name });
    return res.status(200).json({ token });
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate token' });
  }
}

/**
 * Express handler to validate and process incoming LiveKit webhooks.
 */
export async function webhookEndpointHandler(req: any, res: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send('Unauthorized: Missing authorization header');
    }

    // Pass the raw body (string/buffer) and auth header to verify authenticity
    const event = await webhookReceiver.receive(req.body, authHeader);
    console.log('Received LiveKit Webhook Event:', event.event, event);

    switch (event.event) {
      case 'participant_joined':
        // Handle participant join event
        break;
      case 'participant_left':
        // Handle participant leave event
        break;
      case 'room_finished':
        // Handle room closed event
        break;
      default:
        break;
    }

    return res.status(200).send('OK');
  } catch (error: any) {
    console.error('Webhook verification error:', error);
    return res.status(400).send('Invalid webhook signature');
  }
}