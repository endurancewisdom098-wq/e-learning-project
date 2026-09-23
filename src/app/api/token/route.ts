import { AccessToken } from "livekit-server-sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const room = searchParams.get("room");
    const username = searchParams.get("username");

    // Validate request
    if (!room || !username) {
      return Response.json(
        {
          error: "room and username are required",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Get LiveKit credentials from backend .env
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error("LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing");

      return Response.json(
        {
          error: "LiveKit API credentials are missing",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Create LiveKit access token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: username,
      name: username,
    });

    // Give the user permission to join the room
    token.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
    });

    // Generate JWT
    const jwt = await token.toJwt();

    console.log(
      `LiveKit token generated: room=${room}, username=${username}`
    );

    return Response.json(
      {
        token: jwt,
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("LiveKit token generation error:", error);

    return Response.json(
      {
        error: "Failed to generate LiveKit access token",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}