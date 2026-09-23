 import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Document from "@/models/Document";

// DELETE: Remove document by ID
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const deletedDoc = await Document.findByIdAndDelete(id);

    if (!deletedDoc) {
      return NextResponse.json(
        { success: false, message: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Document deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}