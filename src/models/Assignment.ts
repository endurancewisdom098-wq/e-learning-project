import mongoose, { Schema } from "mongoose";

const AssignmentSchema = new Schema(
  {
    courseId: { type: String, required: true },
    title: { type: String, required: true },
    dueDate: { type: Date },
    allowLateSubmissions: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.Assignment || mongoose.model("Assignment", AssignmentSchema);
