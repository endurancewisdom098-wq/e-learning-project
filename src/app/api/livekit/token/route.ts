 import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomName, userName } = body;

    if (!roomName || !userName) {
      return NextResponse.json(
        { error: 'Both roomName and userName are required fields.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'LiveKit API keys are missing in environment variables.' },
        { status: 500 }
      );
    }

    // Create an Access Token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: userName,
    });

    // Grant permissions to join the room and publish/subscribe to audio/video
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}