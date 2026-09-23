import { Router, Request, Response } from 'express';
import { generateUploadPresignedUrl } from '../config/storage';

const router = Router();

router.post('/presigned-url', async (req: Request, res: Response) => {
  try {
    const { fileName, fileType } = req.body;
    const { uploadUrl, fileUrl } = await generateUploadPresignedUrl(fileName, fileType);
    
    res.status(200).json({ uploadUrl, fileUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

export default router;