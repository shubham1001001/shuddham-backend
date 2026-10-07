import express from 'express';
import { getCustomerBookings } from '../controllers/bookingsController.js';
import addressesRoutes from './addressesRoutes.js';

const router = express.Router();

/**
 * @route   GET /api/customer/bookings
 * @desc    Fetch bookings of the authenticated customer via JWT token
 * @access  Private (Bearer token)
 */
router.get('/bookings', getCustomerBookings);

/**
 * @route   /api/customer/addresses
 * @desc    Customer saved addresses CRUD
 * @access  Private (Bearer token)
 */
router.use('/addresses', addressesRoutes);

export default router;
