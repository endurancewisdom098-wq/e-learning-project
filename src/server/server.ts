import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import courseRoutes from '../routes/courseroute';
import enrollmentRoutes from '../routes/enrollmentroute';
import uploadRoutes from './routes/uploadRoutes';
import { AccessToken } from 'livekit-server-sdk';
import livekitRouter from "../routes/livekit.routes";
import authRouter from "../routes/authroutes";
import 'dotenv/config';

dotenv.config();

const app = express();

// Middlewares
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true, // Allows cookies & authorization headers
  })
);

// Body parsers MUST be placed BEFORE routes so req.body is defined!
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// API ROUTES
// ==========================================
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/enrollments', enrollmentRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use("/api/v1/auth", authRouter);
app.use("/api/livekit", livekitRouter);

// ==========================================
// LIVEKIT TOKEN GENERATION ENDPOINT
// ==========================================
const generateLiveKitToken = (roomName: string, participantName: string): string => {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit API keys are missing in backend environment variables.');
  }

  // Create an Access Token
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName, // Unique username or user ID
  });

  // Grant permissions to join the room and publish/subscribe to audio/video
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  // Return the signed JWT token string
  return at.toJwt();
};

app.post('/api/get-token', (req: Request, res: Response) => {
  const { roomName, userName } = req.body;

  if (!roomName || !userName) {
    return res.status(400).json({ error: 'Both roomName and userName are required fields.' });
  }

  try {
    const token = generateLiveKitToken(roomName, userName);
    return res.json({ token });
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// HEALTH CHECK & FALLBACKS
// ==========================================
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "E-Learning Backend API is running",
  });
});

// 404 Route Handler (Catches non-existent API endpoints)
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

// Global Error Handling Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled Error:", err.stack);
  res.status(500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});