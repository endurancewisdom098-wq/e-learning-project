 import { NextResponse } from "next/server";
import connectDB from "@/lib/db"; // Ensure you have your Mongoose connection helper here
import Document from "@/models/Document";

// GET: Fetch all documents
export async function GET() {
  try {
    await connectDB();
    const documents = await Document.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: documents }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST: Create / Save new document metadata
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    const { title, fileName, fileUrl, fileType, fileSize, category } = body;

    if (!title || !fileName || !fileUrl) {
      return NextResponse.json(
        { success: false, message: "Missing required fields." },
        { status: 400 }
      );
    }

    const newDoc = await Document.create({
      title,
      fileName,
      fileUrl,
      fileType,
      fileSize,
      category: category || "lecture_notes",
    });

    return NextResponse.json({ success: true, data: newDoc }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create document" },
      { status: 500 }
    );
  }
}