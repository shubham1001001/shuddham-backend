import express from 'express';
import { getWaterReports, getWaterReportById } from '../controllers/waterReportsController.js';

const router = express.Router();

router.get('/my', getWaterReports);
router.get('/', getWaterReports);
router.get('/:id', getWaterReportById);

export default router;
