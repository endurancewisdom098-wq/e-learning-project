 import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
  Room,
  ParticipantInfo,
  TrackInfo,
  WebhookEvent,
} from 'livekit-server-sdk';

export interface CreateTokenParams {
  roomName: string;
  identity: string;
  name?: string;
  metadata?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  isAdmin?: boolean;
  ttl?: string | number; // e.g., '2h' or seconds
}

export interface CreateRoomOptions {
  name: string;
  emptyTimeout?: number; // Seconds to wait before closing empty room
  maxParticipants?: number;
  metadata?: string;
}

export class LiveKitService {
  private roomService: RoomServiceClient;
  private webhookReceiver: WebhookReceiver;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY || '';
    this.apiSecret = process.env.LIVEKIT_API_SECRET || '';
    const livekitUrl = process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880';

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be defined in environment variables.');
    }

    this.roomService = new RoomServiceClient(livekitUrl, this.apiKey, this.apiSecret);
    this.webhookReceiver = new WebhookReceiver(this.apiKey, this.apiSecret);
  }

  /**
   * Generates a signed JWT token for a participant to join a LiveKit room.
   */
  async createToken(params: CreateTokenParams): Promise<string> {
    const {
      roomName,
      identity,
      name,
      metadata,
      canPublish = true,
      canSubscribe = true,
      isAdmin = false,
      ttl = '6h',
    } = params;

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      name: name || identity,
      metadata,
      ttl,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
      canPublishData: true,
      roomAdmin: isAdmin,
      roomCreate: isAdmin,
    });

    return await at.toJwt();
  }

  /**
   * Explicitly creates a LiveKit room with specific settings.
   */
  async createRoom(options: CreateRoomOptions): Promise<Room> {
    return await this.roomService.createRoom({
      name: options.name,
      emptyTimeout: options.emptyTimeout ?? 600, // 10 minutes default
      maxParticipants: options.maxParticipants ?? 50,
      metadata: options.metadata,
    });
  }

  /**
   * Lists active rooms currently hosted on the server.
   */
  async listRooms(roomNames?: string[]): Promise<Room[]> {
    return await this.roomService.listRooms(roomNames);
  }

  /**
   * Immediately terminates a room and disconnects all participants.
   */
  async deleteRoom(roomName: string): Promise<void> {
    await this.roomService.deleteRoom(roomName);
  }

  /**
   * Lists all participants in a given room.
   */
  async listParticipants(roomName: string): Promise<ParticipantInfo[]> {
    return await this.roomService.listParticipants(roomName);
  }

  /**
   * Gets details for a single participant in a room.
   */
  async getParticipant(roomName: string, identity: string): Promise<ParticipantInfo> {
    return await this.roomService.getParticipant(roomName, identity);
  }

  /**
   * Disconnects a participant from a room.
   */
  async removeParticipant(roomName: string, identity: string): Promise<void> {
    await this.roomService.removeParticipant(roomName, identity);
  }

  /**
   * Mutes or unmutes a specific audio or video track for a participant.
   */
  async mutePublishedTrack(
    roomName: string,
    identity: string,
    trackSid: string,
    muted: boolean
  ): Promise<TrackInfo> {
    return await this.roomService.mutePublishedTrack(roomName, identity, trackSid, muted);
  }

  /**
   * Validates and parses incoming webhook payloads from LiveKit.
   */
  async validateWebhook(body: string | Buffer, authHeader: string): Promise<WebhookEvent> {
    return await this.webhookReceiver.receive(body.toString(), authHeader);
  }
}

// Export a singleton instance for app-wide use
export const livekitService = new LiveKitService();