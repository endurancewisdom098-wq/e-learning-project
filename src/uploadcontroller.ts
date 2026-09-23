import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';

// 1. Configure local storage destination and unique file naming
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Make sure this folder exists in your backend root
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// 2. File filter to accept only videos and PDFs
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('video/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only videos and PDFs are allowed.'));
  }
};

// 3. Initialize multer (Limit size to 500MB for video files)
const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, 
  fileFilter: fileFilter,
});

export const uploadMiddleware = upload.single('file');

// 4. Controller function
export const handleUpload = (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      fileName: req.file.filename,
      filePath: `/uploads/${req.file.filename}`,
      size: req.file.size,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error during upload' });
  }
};