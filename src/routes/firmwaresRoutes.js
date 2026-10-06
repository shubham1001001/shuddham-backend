import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createFirmware, getFirmwares, getLatestFirmware, deleteFirmware } from '../controllers/firmwaresController.js';

const router = express.Router();

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const hv = req.body.hardware_version || 'unknown_hw';
        const fv = req.body.firmware_version || 'unknown_fw';

        // e.g. uploads/0.1/0.21
        const uploadPath = path.join(process.cwd(), 'uploads', hv, fv);

        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        // Check if the uploaded file has a .bin extension
        if (path.extname(file.originalname).toLowerCase() !== '.bin') {
            return cb(new Error('Only .bin files are allowed'));
        }
        cb(null, true);
    }
});

router.post('/', upload.single('bin_file'), createFirmware);
router.get('/latest', getLatestFirmware);
router.get('/', getFirmwares);
router.delete('/:id', deleteFirmware);

export default router;
