import mongoose, { Schema, model, models } from "mongoose";

const LessonSchema = new Schema(
  {
    title: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    videoUrl: { type: String },
    content: { type: String },
    resources: [{ type: Schema.Types.ObjectId, ref: "Document" }],
  },
  { timestamps: true },
);

export default models.Lesson || model("Lesson", LessonSchema);
