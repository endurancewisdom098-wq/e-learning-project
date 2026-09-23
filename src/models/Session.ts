import mongoose, { Schema } from "mongoose";

const SessionSchema = new Schema(
  {
    userId: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export default mongoose.models.Session || mongoose.model("Session", SessionSchema);
