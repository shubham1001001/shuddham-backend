import express from 'express';
import { 
  getBookings, 
  getBookingById, 
  createBooking, 
  updateBookingStatus,
  cancelBooking,
  rescheduleBooking,
  deleteBooking
} from '../controllers/bookingsController.js';

const router = express.Router();

router.get('/', getBookings);
router.get('/:id', getBookingById);
router.post('/', createBooking);
router.patch('/:id', updateBookingStatus);
router.post('/:id/cancel', cancelBooking);
router.post('/:id/reschedule', rescheduleBooking);
router.delete('/:id', deleteBooking);

export default router;

