import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialBookings, initialTechnicians } from '../data/mockData.js';
import { isMySQLActive, query } from '../config/db.js';
import { getAllUsers } from '../data/usersData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'database_bookings.json');

// Helper to normalize phone numbers strictly to 10 digits
const normalizePhone = (phoneStr) => {
  if (!phoneStr) return '';
  const digits = phoneStr.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.substring(1);
  }
  return digits.length > 10 ? digits.slice(-10) : digits;
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
  const serviceName = row.service_title || row.serviceTitle || row.serviceName || '';
  const bookingDate = row.date || row.bookingDate || '';
  const price = Number(row.amount) || Number(row.price) || 499;
  const bookingStatus = row.status || row.bookingStatus || 'Pending';

  return {
    id: row.id,
    customerId: row.customer_id || row.customerId || null,
    customerName: row.customer_name || row.customerName || '',
    customerPhone: row.customer_phone || row.customerPhone || '',
    serviceName: serviceName,
    serviceTitle: serviceName,
    bookingDate: bookingDate,
    date: bookingDate,
    price: price,
    amount: price,
    bookingStatus: bookingStatus,
    status: bookingStatus,
    address: row.address || '',
    timeSlot: row.time_slot || row.timeSlot || '10:00 AM - 12:00 PM',
    technicianId: row.technician_id || row.technicianId || null,
    technicianName: row.technician_name || row.technicianName || 'Unassigned',
    paymentStatus: row.payment_status || row.paymentStatus || 'Pending',
    tdsBefore: row.tds_before !== null && row.tds_before !== undefined ? Number(row.tds_before) : null,
    tdsAfter: row.tds_after !== null && row.tds_after !== undefined ? Number(row.tds_after) : null,
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
        if (rows) {
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
    const customerName = req.body.customerName || req.body.name;
    const customerPhone = req.body.customerPhone || req.body.phone;
    const serviceTitle = req.body.serviceTitle || req.body.serviceName;
    const address = req.body.address;
    const date = req.body.date || req.body.bookingDate;
    const timeSlot = req.body.timeSlot || req.body.slot;
    const amount = req.body.amount !== undefined ? req.body.amount : req.body.price;

    const cleanPhone = normalizePhone(customerPhone);
    if (!customerName || !cleanPhone || cleanPhone.length !== 10 || !serviceTitle || !address || !address.trim()) {
      return res.status(400).json({ success: false, message: 'Valid customer name, 10-digit phone number, service title, and address are required' });
    }

    // Extract customer ID from auth header if present
    let customerId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          customerId = payload.userId || payload.id || payload.sub || null;
        }
      } catch (e) {}
    }

    const newBooking = {
      id: `BK-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: customerId,
      customerName,
      customerPhone: cleanPhone,
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
            id, customer_id, customer_name, customer_phone, service_title, address, date, time_slot,
            status, technician_id, technician_name, amount, payment_status, tds_before, tds_after
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newBooking.id,
          newBooking.customerId,
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
  const { status, technicianId, tdsBefore, tdsAfter, customerPhone, phone } = req.body;

  let cleanPhone = null;
  if (customerPhone || phone) {
    cleanPhone = normalizePhone(customerPhone || phone);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Customer mobile number must be exactly 10 digits' });
    }
  }

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
      if (cleanPhone) { updates.push('customer_phone = ?'); params.push(cleanPhone); }

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
  if (cleanPhone) booking.customerPhone = cleanPhone;
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

/**
 * @route   GET /api/customer/bookings (also /api/bookings/my-bookings)
 * @desc    Fetch only the authenticated customer's bookings using their JWT token
 * @access  Private (Requires Bearer token, customer ID extracted from token)
 */
export const getCustomerBookings = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Missing or invalid Authorization header.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required.'
      });
    }

    const parts = token.split('.');
    if (parts.length < 2) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session token format.'
      });
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch (parseErr) {
      return res.status(401).json({
        success: false,
        message: 'Failed to decode authorization token payload.'
      });
    }

    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return res.status(401).json({
        success: false,
        message: 'Session has expired. Please sign in again.'
      });
    }

    const customerId = payload.userId || payload.id || payload.sub;
    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No user identifier present in token.'
      });
    }

    // Lookup customer profile from database to also match by their registered phone or email
    let userRecord = null;
    if (isMySQLActive()) {
      try {
        const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [customerId]);
        if (rows && rows.length > 0) userRecord = rows[0];
      } catch (e) {}
    }
    if (!userRecord) {
      try {
        const allUsers = getAllUsers();
        userRecord = allUsers.find(u => u.id === customerId);
      } catch (e) {}
    }

    const userPhone = userRecord ? normalizePhone(userRecord.phone) : '';
    const userEmail = userRecord && userRecord.email ? userRecord.email.toLowerCase().trim() : '';

    const { status } = req.query;

    // 1. Fetch from MySQL if active
    if (isMySQLActive()) {
      try {
        let sql = `
          SELECT * FROM bookings 
          WHERE (customer_id = ? 
             OR (? != '' AND (customer_phone LIKE ? OR phone LIKE ?)))
        `;
        const params = [customerId, userPhone, `%${userPhone}%`, `%${userPhone}%`];

        if (status && status !== 'all') {
          sql += ' AND LOWER(status) = ?';
          params.push(status.toLowerCase());
        }

        sql += ' ORDER BY created_at DESC';

        const rows = await query(sql, params);
        if (rows) {
          const mapped = rows.map(mapRowToBooking);
          return res.status(200).json({
            success: true,
            count: mapped.length,
            customerId,
            data: mapped
          });
        }
      } catch (dbErr) {
        console.warn('[Bookings Controller] MySQL getCustomerBookings warning:', dbErr.message);
      }
    }

    // 2. Fetch from Disk / Memory Fallback
    const bookings = loadBookingsDisk();
    let filtered = bookings.filter(b => {
      // Must match customerId or user phone or user email
      const matchesId = b.customerId === customerId || b.customer_id === customerId;
      const bPhone = normalizePhone(b.customerPhone || b.phone || '');
      const matchesPhone = userPhone.length >= 7 && (bPhone.includes(userPhone) || userPhone.includes(bPhone));
      const bEmail = (b.customerEmail || b.email || '').toLowerCase().trim();
      const matchesEmail = userEmail.length > 3 && bEmail === userEmail;

      return matchesId || matchesPhone || matchesEmail;
    });

    if (status && status !== 'all') {
      filtered = filtered.filter(b => b.status && b.status.toLowerCase() === status.toLowerCase());
    }

    const formatted = filtered.map(b => mapRowToBooking(b));
    return res.status(200).json({
      success: true,
      count: formatted.length,
      customerId,
      data: formatted
    });
  } catch (error) {
    console.error('[Bookings Controller] getCustomerBookings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer bookings',
      error: error.message
    });
  }
};
