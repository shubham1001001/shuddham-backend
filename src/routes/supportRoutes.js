import express from 'express';
import { createSupportTicket, getSupportTickets } from '../controllers/supportController.js';

const router = express.Router();

router.get('/tickets', getSupportTickets);
router.post('/tickets', createSupportTicket);
router.get('/', getSupportTickets);
router.post('/', createSupportTicket);

export default router;
