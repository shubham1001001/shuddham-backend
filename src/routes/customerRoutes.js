import express from 'express';
import { getCustomerBookings } from '../controllers/bookingsController.js';
import { getCustomerDevices } from '../controllers/inventoryController.js';
import addressesRoutes from './addressesRoutes.js';

const router = express.Router();

/**
 * @route   GET /api/customer/bookings
 * @desc    Fetch bookings of the authenticated customer via JWT token
 * @access  Private (Bearer token)
 */
router.get('/bookings', getCustomerBookings);

/**
 * @route   GET /api/customer/devices
 * @desc    Fetch purifiers/devices assigned to this authenticated customer
 * @access  Private (Bearer token or ?phone=...)
 */
router.get('/devices', getCustomerDevices);

/**
 * @route   /api/customer/addresses
 * @desc    Customer saved addresses CRUD
 * @access  Private (Bearer token)
 */
router.use('/addresses', addressesRoutes);

export default router;
