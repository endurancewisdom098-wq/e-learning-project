import mongoose from 'mongoose';
import { prisma } from '@/lib/prisma';

// Prevent multiple Prisma Client instances in Next.js development hot-reloading
export const db = prisma;

export default async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;

  const mongoUrl = process.env.MONGODB_URI;
  if (!mongoUrl) {
    throw new Error('MONGODB_URI is not configured.');
  }

  await mongoose.connect(mongoUrl);
  return mongoose;
}

// ---------------- TYPES & INTERFACES ----------------

export interface FileAssetRecord {
  id: string;
  fileName: string;
  relativePath: string;
  folderPath: string;
  publicUrl: string;
  size: number;
  mimeType: string;
  uploadedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFileInput {
  fileName: string;
  relativePath: string;
  publicUrl: string;
  size: number;
  mimeType: string;
  uploadedBy?: string;
}

export interface FileQueryOptions {
  folderPath?: string;
  search?: string;
  mimeType?: string;
  page?: number;
  limit?: number;
  sortBy?: 'fileName' | 'size' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface StorageMetrics {
  totalFiles: number;
  totalBytes: number;
  typeBreakdown: Record<string, { count: number; bytes: number }>;
}

// ---------------- CRUD & QUERY OPERATIONS ----------------

/**
 * Extracts the parent folder path from a relative path
 * e.g., 'documents/2026/report.pdf' -> 'documents/2026'
 */
function extractFolderPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex === -1) return '';
  return normalized.substring(0, lastSlashIndex);
}

/**
 * Saves a single uploaded file metadata record to the database
 */
export async function createFileRecord(data: CreateFileInput): Promise<FileAssetRecord> {
  const folderPath = extractFolderPath(data.relativePath);

  return await prisma.fileAsset.create({
    data: {
      fileName: data.fileName,
      relativePath: data.relativePath,
      folderPath,
      publicUrl: data.publicUrl,
      size: data.size,
      mimeType: data.mimeType,
      uploadedBy: data.uploadedBy || 'admin',
    },
  });
}

/**
 * Performs atomic batch insert for folder/multi-file uploads
 */
export async function createBatchFileRecords(items: CreateFileInput[]): Promise<{ count: number }> {
  const records = items.map((data) => ({
    fileName: data.fileName,
    relativePath: data.relativePath,
    folderPath: extractFolderPath(data.relativePath),
    publicUrl: data.publicUrl,
    size: data.size,
    mimeType: data.mimeType,
    uploadedBy: data.uploadedBy || 'admin',
  }));

  return await prisma.fileAsset.createMany({
    data: records,
    skipDuplicates: true,
  });
}

/**
 * Queries stored files with pagination, search, directory scope, and sorting
 */
export async function getFileRecords(options: FileQueryOptions = {}) {
  const {
    folderPath,
    search,
    mimeType,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const whereClause: any = {};

  if (folderPath !== undefined) {
    whereClause.folderPath = folderPath;
  }

  if (mimeType) {
    whereClause.mimeType = { startsWith: mimeType };
  }

  if (search) {
    whereClause.OR = [
      { fileName: { contains: search, mode: 'insensitive' } },
      { relativePath: { contains: search, mode: 'insensitive' } },
    ];
  }

  const offset = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.fileAsset.findMany({
      where: whereClause,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.fileAsset.count({ where: whereClause }),
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Retrieves a single file record by database ID
 */
export async function getFileById(id: string): Promise<FileAssetRecord | null> {
  return await prisma.fileAsset.findUnique({
    where: { id },
  });
}

/**
 * Retrieves a single file record by relative path
 */
export async function getFileByRelativePath(relativePath: string): Promise<FileAssetRecord | null> {
  return await prisma.fileAsset.findFirst({
    where: { relativePath },
  });
}

/**
 * Deletes a file record by ID
 */
export async function deleteFileRecord(id: string): Promise<FileAssetRecord> {
  return await prisma.fileAsset.delete({
    where: { id },
  });
}

/**
 * Deletes all file metadata residing under a specific folder path
 */
export async function deleteFolderRecords(folderPath: string): Promise<{ count: number }> {
  return await prisma.fileAsset.deleteMany({
    where: {
      OR: [
        { folderPath },
        { folderPath: { startsWith: `${folderPath}/` } },
      ],
    },
  });
}

/**
 * Aggregates overall storage metrics, total byte usage, and breakdown by MIME category
 */
export async function getStorageMetrics(): Promise<StorageMetrics> {
  const aggregate = await prisma.fileAsset.aggregate({
    _count: { id: true },
    _sum: { size: true },
  });

  const files = await prisma.fileAsset.findMany({
    select: { size: true, mimeType: true },
  });

  const typeBreakdown: Record<string, { count: number; bytes: number }> = {};

  files.forEach((file) => {
    const category = file.mimeType ? file.mimeType.split('/')[0] : 'other';
    if (!typeBreakdown[category]) {
      typeBreakdown[category] = { count: 0, bytes: 0 };
    }
    typeBreakdown[category].count += 1;
    typeBreakdown[category].bytes += file.size;
  });

  return {
    totalFiles: aggregate._count.id || 0,
    totalBytes: aggregate._sum.size || 0,
    typeBreakdown,
  };
}

export { connectDB };