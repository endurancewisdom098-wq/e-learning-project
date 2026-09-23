import { Router } from "express";
import { registerUser, loginUser } from "../controllers/authcontroller";
import { uploadMiddleware, handleUpload } from '../controllers/uploadController';
import { verifyToken } from '../middleware/authMiddleware';

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post('/upload', verifyToken, uploadMiddleware, handleUpload);

export default router;