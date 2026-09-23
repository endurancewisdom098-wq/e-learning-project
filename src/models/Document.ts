 import mongoose, { Schema, Document as MongooseDoc, models, model } from "mongoose";

export interface IDocument extends MongooseDoc {
  title: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: "lecture_notes" | "assignment" | "syllabus" | "other";
  uploadedBy: string;
  createdAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    category: {
      type: String,
      enum: ["lecture_notes", "assignment", "syllabus", "other"],
      default: "lecture_notes",
    },
    uploadedBy: { type: String, default: "Instructor" },
  },
  { timestamps: true }
);

export default models.Document || model<IDocument>("Document", DocumentSchema);