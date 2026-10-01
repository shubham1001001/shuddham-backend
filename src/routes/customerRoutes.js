import express from 'express';
import { getCustomerBookings } from '../controllers/bookingsController.js';

const router = express.Router();

/**
 * @route   GET /api/customer/bookings
 * @desc    Fetch bookings of the authenticated customer via JWT token
 * @access  Private (Bearer token)
 */
router.get('/bookings', getCustomerBookings);

export default router;
