import mongoose, { Schema } from "mongoose";

const EnrollmentSchema = new Schema(
  {
    courseId: { type: String, required: true },
    studentId: { type: String, required: true },
    status: { type: String, default: "active" },
  },
  { timestamps: true },
);

export default mongoose.models.Enrollment || mongoose.model("Enrollment", EnrollmentSchema);
