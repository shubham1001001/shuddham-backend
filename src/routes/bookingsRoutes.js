import express from 'express';
import { 
  getBookings, 
  getBookingById, 
  createBooking, 
  updateBookingStatus,
  cancelBooking,
  rescheduleBooking,
  deleteBooking,
  getCustomerBookings,
  assignBooking,
  unassignBooking,
  bulkAssignBookings,
  getTechnicianBookings
} from '../controllers/bookingsController.js';

const router = express.Router();

router.get('/my-bookings', getCustomerBookings);
router.get('/technician/:technicianId', getTechnicianBookings);
router.post('/bulk-assign', bulkAssignBookings);

router.get('/', getBookings);
router.get('/:id', getBookingById);
router.post('/', createBooking);
router.patch('/:id', updateBookingStatus);
router.post('/:id/assign', assignBooking);
router.patch('/:id/assign', assignBooking);
router.post('/:id/unassign', unassignBooking);
router.patch('/:id/unassign', unassignBooking);
router.post('/:id/cancel', cancelBooking);
router.post('/:id/reschedule', rescheduleBooking);
router.delete('/:id', deleteBooking);

export default router;

