 import { NextRequest, NextResponse } from 'next/server';
import { saveFile, sanitizeRelativePath } from '@/lib/storage';
import path from 'path';

// Max file upload limit: 50 MB
const MAX_BATCH_SIZE_BYTES = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract metadata
    const studentId = (formData.get('studentId') as string) || 'std_alex_morgan';
    const courseId = (formData.get('courseId') as string) || 'CS201';
    const assignmentId = (formData.get('assignmentId') as string) || 'general';
    
    const files = formData.getAll('files') as File[];
    const relativePaths = formData.getAll('paths') as string[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files or folders provided for submission.' },
        { status: 400 }
      );
    }

    // Validate total batch payload size
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > MAX_BATCH_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Submission exceeds maximum allowed limit of 50 MB.' },
        { status: 400 }
      );
    }

    const savedRecords: Awaited<ReturnType<typeof saveFile>>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rawRelativePath = relativePaths[i] || file.name;
      
      // Construct isolated path scope per student and course
      // e.g., "students/std_alex_morgan/CS201/sprint-2/src/index.ts"
      const studentScopedPath = path.join(
        'students',
        studentId,
        courseId,
        assignmentId,
        rawRelativePath
      );

      const sanitizedPath = sanitizeRelativePath(studentScopedPath);

      // Save binary file to server disk
      const savedMetadata = await saveFile(file, sanitizedPath, {
        overwrite: true,
        mimeType: file.type,
      });

      savedRecords.push(savedMetadata);

    }

    return NextResponse.json({
      success: true,
      message: 'Files and folders uploaded successfully.',
      count: savedRecords.length,
      totalSize,
      files: savedRecords,
    });
  } catch (error) {
    console.error('Student Upload API Error:', error);
    return NextResponse.json(
      { error: 'An error occurred while saving your files.' },
      { status: 500 }
    );
  }
}