import mongoose, { Schema } from "mongoose";

const SubmissionSchema = new Schema(
  {
    assignmentId: { type: String, required: true },
    studentId: { type: String, required: true },
    courseId: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    comments: { type: String, default: "" },
    submittedAt: { type: Date },
    status: { type: String, default: "submitted" },
  },
  { timestamps: true },
);

export default mongoose.models.Submission || mongoose.model("Submission", SubmissionSchema);
