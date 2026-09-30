import { initialBookings, initialTechnicians } from '../data/mockData.js';

let bookings = [...initialBookings];

export const getBookings = (req, res) => {
  const { status } = req.query;
  if (status) {
    const filtered = bookings.filter(b => b.status.toLowerCase() === status.toLowerCase());
    return res.json({ success: true, count: filtered.length, data: filtered });
  }
  res.json({ success: true, count: bookings.length, data: bookings });
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
    tdsAfter: null
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
