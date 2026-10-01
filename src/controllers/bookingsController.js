import { initialBookings, initialTechnicians } from '../data/mockData.js';

let bookings = [...initialBookings];

// Helper to normalize phone numbers for searching
const normalizePhone = (phoneStr) => {
  if (!phoneStr) return '';
  const digits = phoneStr.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

export const getBookings = (req, res) => {
  const { status, customerPhone } = req.query;
  let filtered = [...bookings];

  if (status && status !== 'all') {
    filtered = filtered.filter(b => b.status.toLowerCase() === status.toLowerCase());
  }

  if (customerPhone) {
    const cleanPhone = normalizePhone(customerPhone);
    filtered = filtered.filter(b => normalizePhone(b.customerPhone).includes(cleanPhone));
  }

  res.json({ success: true, count: filtered.length, data: filtered });
};

export const getBookingById = (req, res) => {
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }
  res.json({ success: true, data: booking });
};

export const createBooking = (req, res) => {
  const { customerName, customerPhone, serviceTitle, address, date, timeSlot, amount } = req.body;
  if (!customerName || !customerPhone || !serviceTitle) {
    return res.status(400).json({ success: false, message: 'Name, phone, and service are required' });
  }

  const newBooking = {
    id: `BK-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName,
    customerPhone,
    serviceTitle,
    address: address || 'Default Address',
    date: date || new Date().toISOString().split('T')[0],
    timeSlot: timeSlot || '10:00 AM - 12:00 PM',
    status: 'Pending',
    technicianId: null,
    technicianName: 'Unassigned',
    amount: amount || 499,
    paymentStatus: 'Pending',
    tdsBefore: null,
    tdsAfter: null,
    createdAt: new Date().toISOString()
  };

  bookings.unshift(newBooking);
  res.status(201).json({ success: true, message: 'Booking submitted successfully', data: newBooking });
};

export const updateBookingStatus = (req, res) => {
  const { id } = req.params;
  const { status, technicianId, tdsBefore, tdsAfter } = req.body;

  const booking = bookings.find(b => b.id === id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  if (status) booking.status = status;
  if (tdsBefore !== undefined) booking.tdsBefore = tdsBefore;
  if (tdsAfter !== undefined) booking.tdsAfter = tdsAfter;

  if (technicianId) {
    const tech = initialTechnicians.find(t => t.id === technicianId);
    if (tech) {
      booking.technicianId = tech.id;
      booking.technicianName = tech.name;
      if (booking.status === 'Pending') booking.status = 'Assigned';
    }
  }

  res.json({ success: true, message: 'Booking updated', data: booking });
};

export const cancelBooking = (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  const booking = bookings.find(b => b.id === id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  booking.status = 'Cancelled';
  booking.cancellationReason = reason || 'Cancelled by customer';
  booking.cancelledAt = new Date().toISOString();

  res.json({ success: true, message: 'Booking cancelled successfully', data: booking });
};

export const rescheduleBooking = (req, res) => {
  const { id } = req.params;
  const { date, timeSlot } = req.body || {};

  const booking = bookings.find(b => b.id === id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  if (date) booking.date = date;
  if (timeSlot) booking.timeSlot = timeSlot;
  booking.updatedAt = new Date().toISOString();

  res.json({ success: true, message: 'Booking rescheduled successfully', data: booking });
};

export const deleteBooking = (req, res) => {
  const { id } = req.params;
  const index = bookings.findIndex(b => b.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  bookings.splice(index, 1);
  res.json({ success: true, message: 'Booking deleted successfully' });
};

