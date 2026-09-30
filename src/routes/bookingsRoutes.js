import express from 'express';
import { getBookings, getBookingById, createBooking, updateBookingStatus } from '../controllers/bookingsController.js';

const router = express.Router();

router.get('/', getBookings);
router.get('/:id', getBookingById);
router.post('/', createBooking);
router.patch('/:id', updateBookingStatus);

export default router;
