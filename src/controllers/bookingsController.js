import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialBookings, initialTechnicians } from '../data/mockData.js';
import { isMySQLActive, query } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'database_bookings.json');

// Helper to normalize phone numbers for searching
const normalizePhone = (phoneStr) => {
  if (!phoneStr) return '';
  const digits = phoneStr.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

// Disk Persistence Helpers
function loadBookingsDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BOOKINGS_FILE)) {
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(initialBookings, null, 2), 'utf-8');
      return [...initialBookings];
    }
    const raw = fs.readFileSync(BOOKINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [...initialBookings];
  } catch (err) {
    console.error('[Bookings DB] Error loading bookings from disk:', err.message);
    return [...initialBookings];
  }
}

function saveBookingsDisk(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Bookings DB] Error saving bookings to disk:', err.message);
    return false;
  }
}

// Transform MySQL snake_case row to frontend camelCase booking model
function mapRowToBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerName: row.customer_name || row.customerName,
    customerPhone: row.customer_phone || row.customerPhone,
    serviceTitle: row.service_title || row.serviceTitle,
    address: row.address,
    date: row.date,
    timeSlot: row.time_slot || row.timeSlot,
    status: row.status,
    technicianId: row.technician_id || row.technicianId,
    technicianName: row.technician_name || row.technicianName,
    amount: Number(row.amount) || 499,
    paymentStatus: row.payment_status || row.paymentStatus || 'Pending',
    tdsBefore: row.tds_before !== null ? Number(row.tds_before) : null,
    tdsAfter: row.tds_after !== null ? Number(row.tds_after) : null,
    cancellationReason: row.cancellation_reason || row.cancellationReason || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString()
  };
}

export const getBookings = async (req, res) => {
  try {
    const { status, customerPhone } = req.query;

    // 1. Try MySQL Database first
    if (isMySQLActive()) {
      try {
        let sql = 'SELECT * FROM bookings WHERE 1=1';
        const params = [];

        if (status && status !== 'all') {
          sql += ' AND LOWER(status) = ?';
          params.push(status.toLowerCase());
        }

        if (customerPhone) {
          const cleanPhone = normalizePhone(customerPhone);
          sql += ' AND (phone LIKE ? OR customer_phone LIKE ?)';
          params.push(`%${cleanPhone}%`, `%${cleanPhone}%`);
        }

        sql += ' ORDER BY created_at DESC';

        const rows = await query(sql, params);
        if (rows && rows.length > 0) {
          const mapped = rows.map(mapRowToBooking);
          return res.json({ success: true, count: mapped.length, data: mapped });
        }
      } catch (dbErr) {
        console.warn('[Bookings DB] MySQL query note:', dbErr.message);
      }
    }

    // 2. Disk / Memory Fallback
    const bookings = loadBookingsDisk();
    let filtered = [...bookings];

    if (status && status !== 'all') {
      filtered = filtered.filter(b => b.status.toLowerCase() === status.toLowerCase());
    }

    if (customerPhone) {
      const cleanPhone = normalizePhone(customerPhone);
      filtered = filtered.filter(b => normalizePhone(b.customerPhone).includes(cleanPhone));
    }

    return res.json({ success: true, count: filtered.length, data: filtered });
  } catch (error) {
    console.error('[Bookings Controller] GetBookings Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve bookings', error: error.message });
  }
};

export const getBookingById = async (req, res) => {
  const { id } = req.params;

  if (isMySQLActive()) {
    try {
      const rows = await query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [id]);
      if (rows && rows.length > 0) {
        return res.json({ success: true, data: mapRowToBooking(rows[0]) });
      }
    } catch (e) {}
  }

  const bookings = loadBookingsDisk();
  const booking = bookings.find(b => b.id === id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }
  return res.json({ success: true, data: booking });
};

export const createBooking = async (req, res) => {
  try {
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
      amount: Number(amount) || 499,
      paymentStatus: 'Pending',
      tdsBefore: null,
      tdsAfter: null,
      cancellationReason: null,
      createdAt: new Date().toISOString()
    };

    // 1. Save to MySQL Table
    if (isMySQLActive()) {
      try {
        await query(`
          INSERT INTO bookings (
            id, customer_name, customer_phone, service_title, address, date, time_slot,
            status, technician_id, technician_name, amount, payment_status, tds_before, tds_after
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newBooking.id,
          newBooking.customerName,
          newBooking.customerPhone,
          newBooking.serviceTitle,
          newBooking.address,
          newBooking.date,
          newBooking.timeSlot,
          newBooking.status,
          newBooking.technicianId,
          newBooking.technicianName,
          newBooking.amount,
          newBooking.paymentStatus,
          newBooking.tdsBefore,
          newBooking.tdsAfter
        ]);
        console.log(`[MySQL Database] Booking "${newBooking.id}" inserted into MySQL bookings table!`);
      } catch (dbErr) {
        console.warn('[MySQL Database] Booking insert warning:', dbErr.message);
      }
    }

    // 2. Save to Disk JSON database
    const bookings = loadBookingsDisk();
    bookings.unshift(newBooking);
    saveBookingsDisk(bookings);

    return res.status(201).json({ success: true, message: 'Booking submitted successfully', data: newBooking });
  } catch (error) {
    console.error('[Bookings Controller] CreateBooking Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create booking', error: error.message });
  }
};

export const updateBookingStatus = async (req, res) => {
  const { id } = req.params;
  const { status, technicianId, tdsBefore, tdsAfter } = req.body;

  let techName = null;
  if (technicianId) {
    const tech = initialTechnicians.find(t => t.id === technicianId);
    if (tech) techName = tech.name;
  }

  // 1. Update in MySQL Table
  if (isMySQLActive()) {
    try {
      const updates = [];
      const params = [];
      if (status) { updates.push('status = ?'); params.push(status); }
      if (tdsBefore !== undefined) { updates.push('tds_before = ?'); params.push(tdsBefore); }
      if (tdsAfter !== undefined) { updates.push('tds_after = ?'); params.push(tdsAfter); }
      if (technicianId) { updates.push('technician_id = ?'); params.push(technicianId); }
      if (techName) { updates.push('technician_name = ?'); params.push(techName); }

      if (updates.length > 0) {
        params.push(id);
        await query(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`, params);
      }
    } catch (e) {}
  }

  // 2. Update Disk file
  const bookings = loadBookingsDisk();
  const booking = bookings.find(b => b.id === id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  if (status) booking.status = status;
  if (tdsBefore !== undefined) booking.tdsBefore = tdsBefore;
  if (tdsAfter !== undefined) booking.tdsAfter = tdsAfter;
  if (technicianId) {
    booking.technicianId = technicianId;
    if (techName) booking.technicianName = techName;
    if (booking.status === 'Pending') booking.status = 'Assigned';
  }

  saveBookingsDisk(bookings);
  return res.json({ success: true, message: 'Booking updated', data: booking });
};

export const cancelBooking = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const cancellationReason = reason || 'Cancelled by customer';

  // 1. Update in MySQL Table
  if (isMySQLActive()) {
    try {
      await query(
        'UPDATE bookings SET status = ?, cancellation_reason = ? WHERE id = ?',
        ['Cancelled', cancellationReason, id]
      );
    } catch (e) {}
  }

  // 2. Update Disk file
  const bookings = loadBookingsDisk();
  const booking = bookings.find(b => b.id === id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  booking.status = 'Cancelled';
  booking.cancellationReason = cancellationReason;
  booking.cancelledAt = new Date().toISOString();

  saveBookingsDisk(bookings);
  return res.json({ success: true, message: 'Booking cancelled successfully', data: booking });
};

export const rescheduleBooking = async (req, res) => {
  const { id } = req.params;
  const { date, timeSlot } = req.body || {};

  // 1. Update in MySQL Table
  if (isMySQLActive()) {
    try {
      await query('UPDATE bookings SET date = ?, time_slot = ? WHERE id = ?', [date, timeSlot, id]);
    } catch (e) {}
  }

  // 2. Update Disk file
  const bookings = loadBookingsDisk();
  const booking = bookings.find(b => b.id === id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  if (date) booking.date = date;
  if (timeSlot) booking.timeSlot = timeSlot;
  booking.updatedAt = new Date().toISOString();

  saveBookingsDisk(bookings);
  return res.json({ success: true, message: 'Booking rescheduled successfully', data: booking });
};

export const deleteBooking = async (req, res) => {
  const { id } = req.params;

  // 1. Delete in MySQL Table
  if (isMySQLActive()) {
    try {
      await query('DELETE FROM bookings WHERE id = ?', [id]);
    } catch (e) {}
  }

  // 2. Delete in Disk file
  const bookings = loadBookingsDisk();
  const index = bookings.findIndex(b => b.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  bookings.splice(index, 1);
  saveBookingsDisk(bookings);
  return res.json({ success: true, message: 'Booking deleted successfully' });
};
