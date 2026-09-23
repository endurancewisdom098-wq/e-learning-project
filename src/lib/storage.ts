import { writeFile, mkdir, readdir, stat, unlink, rm, access } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Server storage configuration
const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), 'public', 'uploads');

export interface StoredFileMetadata {
  id: string;
  fileName: string;
  relativePath: string;
  publicUrl: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface DirectoryListingItem {
  name: string;
  relativePath: string;
  type: 'file' | 'folder';
  size: number;
  updatedAt: string;
}

/**
 * Sanitizes relative paths to prevent Path Traversal attacks (e.g., '../../etc/passwd')
 */
export function sanitizeRelativePath(userPath: string): string {
  // Replace backslashes with forward slashes and strip leading slashes
  const normalized = userPath.replace(/\\/g, '/').replace(/^\/+/, '');
  
  // Resolve path and check bounds against base directory
  const safePath = path.normalize(normalized).replace(/^(\.\.[\/\\])+/, '');
  const absolutePath = path.join(UPLOAD_BASE_DIR, safePath);

  if (!absolutePath.startsWith(UPLOAD_BASE_DIR)) {
    throw new Error('Security Error: Invalid directory path out of storage root.');
  }

  return safePath;
}

/**
 * Ensures specified directory path exists on disk
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Saves a single file buffer or Web File object to disk, preserving folder hierarchy
 */
export async function saveFile(
  file: File | Buffer,
  relativePath: string,
  options: { overwrite?: boolean; originalName?: string; mimeType?: string } = {}
): Promise<StoredFileMetadata> {
  const safeRelativePath = sanitizeRelativePath(relativePath);
  const targetAbsolutePath = path.join(UPLOAD_BASE_DIR, safeRelativePath);
  const targetDir = path.dirname(targetAbsolutePath);

  // Ensure target folder exists
  await ensureDirectoryExists(targetDir);

  // Extract file properties
  let fileBuffer: Buffer;
  let size = 0;
  let fileName = path.basename(safeRelativePath);
  let mimeType = options.mimeType || 'application/octet-stream';

  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    size = file.size;
    fileName = file.name || fileName;
    mimeType = file.type || mimeType;
  } else {
    fileBuffer = file;
    size = fileBuffer.byteLength;
  }

  // Handle overwrite collisions
  if (!options.overwrite && (await fileExists(safeRelativePath))) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const uniqueSuffix = crypto.randomBytes(4).toString('hex');
    const newFileName = `${base}_${uniqueSuffix}${ext}`;
    const newRelativePath = path.join(path.dirname(safeRelativePath), newFileName);
    return saveFile(file, newRelativePath, { ...options, overwrite: true });
  }

  // Write file to disk
  await writeFile(targetAbsolutePath, fileBuffer);

  const fileId = crypto.randomUUID();
  const publicUrl = `/uploads/${safeRelativePath.replace(/\\/g, '/')}`;

  return {
    id: fileId,
    fileName,
    relativePath: safeRelativePath,
    publicUrl,
    size,
    mimeType,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Saves multiple files or an entire folder tree structure
 */
export async function saveMultipleFiles(
  files: File[],
  relativePaths: string[]
): Promise<StoredFileMetadata[]> {
  if (files.length !== relativePaths.length) {
    throw new Error('Files count and relative paths count must match.');
  }

  const results: StoredFileMetadata[] = [];
  for (let i = 0; i < files.length; i++) {
    const saved = await saveFile(files[i], relativePaths[i]);
    results.push(saved);
  }

  return results;
}

/**
 * Deletes a file or directory recursively from storage
 */
export async function deleteStorageItem(relativePath: string): Promise<boolean> {
  try {
    const safeRelativePath = sanitizeRelativePath(relativePath);
    const targetAbsolutePath = path.join(UPLOAD_BASE_DIR, safeRelativePath);

    const stats = await stat(targetAbsolutePath);
    if (stats.isDirectory()) {
      await rm(targetAbsolutePath, { recursive: true, force: true });
    } else {
      await unlink(targetAbsolutePath);
    }
    return true;
  } catch (error) {
    console.error(`Failed to delete item at "${relativePath}":`, error);
    return false;
  }
}

/**
 * Checks if a file or folder exists in storage
 */
export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    const safeRelativePath = sanitizeRelativePath(relativePath);
    const targetAbsolutePath = path.join(UPLOAD_BASE_DIR, safeRelativePath);
    await access(targetAbsolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists contents of a storage directory
 */
export async function listDirectoryContents(
  relativePath: string = ''
): Promise<DirectoryListingItem[]> {
  const safeRelativePath = sanitizeRelativePath(relativePath);
  const targetAbsolutePath = path.join(UPLOAD_BASE_DIR, safeRelativePath);

  await ensureDirectoryExists(targetAbsolutePath);

  const entries = await readdir(targetAbsolutePath, { withFileTypes: true });
  const items: DirectoryListingItem[] = [];

  for (const entry of entries) {
    const entryRelativePath = path.join(safeRelativePath, entry.name);
    const entryAbsolutePath = path.join(targetAbsolutePath, entry.name);
    const entryStats = await stat(entryAbsolutePath);

    items.push({
      name: entry.name,
      relativePath: entryRelativePath.replace(/\\/g, '/'),
      type: entry.isDirectory() ? 'folder' : 'file',
      size: entry.isDirectory() ? 0 : entryStats.size,
      updatedAt: entryStats.mtime.toISOString(),
    });
  }

  return items;
}

/**
 * Formats bytes into human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}