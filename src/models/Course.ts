import mongoose, { Schema } from "mongoose";

const CourseSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    instructorId: { type: String },
  },
  { timestamps: true },
);

export default mongoose.models.Course || mongoose.model("Course", CourseSchema);
