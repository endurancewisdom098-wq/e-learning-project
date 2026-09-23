import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize the S3 Client using environment variables
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'your-elearning-bucket-name';

/**
 * Generates a pre-signed URL to allow a user/instructor to upload a file directly to S3.
 * @param fileName The name/path of the file in the bucket (e.g., 'courses/videos/intro.mp4')
 * @param fileType The MIME type of the file (e.g., 'video/mp4', 'application/pdf')
 * @returns A pre-signed upload URL valid for a limited time (e.g., 5 minutes)
 */
export const generateUploadPresignedUrl = async (
  fileName: string,
  fileType: string
): Promise<{ uploadUrl: string; fileUrl: string }> => {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      ContentType: fileType,
    });

    // URL expires in 300 seconds (5 minutes)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    
    // The permanent public/CDN URL of the file after upload
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;

    return { uploadUrl, fileUrl };
  } catch (error) {
    console.error('Error generating upload pre-signed URL:', (error as Error).message);
    throw new Error('Could not generate upload URL');
  }
};

/**
 * Generates a secure, temporary pre-signed download URL for private course materials or videos.
 * @param fileName The key/path of the file in the S3 bucket
 * @returns A temporary pre-signed viewing/download link valid for 1 hour
 */
export const generateDownloadPresignedUrl = async (fileName: string): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
    });

    // URL expires in 3600 seconds (1 hour)
    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return downloadUrl;
  } catch (error) {
    console.error('Error generating download pre-signed URL:', (error as Error).message);
    throw new Error('Could not generate secure file access URL');
  }
};

export default s3Client;