import { query } from '../config/db.js';

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

// Transform MySQL row to camelCase booking model
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
    let sql = 'SELECT * FROM `bookings` WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND LOWER(`status`) = ?';
      params.push(status.toLowerCase());
    }

    if (customerPhone) {
      const cleanPhone = normalizePhone(customerPhone);
      sql += ' AND (`customer_phone` LIKE ?)';
      params.push(`%${cleanPhone}%`);
    }

    sql += ' ORDER BY `created_at` DESC';

    const rows = await query(sql, params);
    const mapped = Array.isArray(rows) ? rows.map(mapRowToBooking) : [];
    return res.json({ success: true, count: mapped.length, data: mapped });
  } catch (error) {
    console.error('[Bookings Controller] GetBookings Error:', error.message);
    return res.status(500).json({ success: false, message: 'Database error retrieving bookings', error: error.message });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1', [id]);
    if (rows && rows.length > 0) {
      return res.json({ success: true, data: mapRowToBooking(rows[0]) });
    }
    return res.status(404).json({ success: false, message: 'Booking not found' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Database error', error: error.message });
  }
};

export const createBooking = async (req, res) => {
  try {
    const customerName = req.body.customerName || req.body.name;
    const customerPhone = req.body.customerPhone || req.body.phone;
    const serviceTitle = req.body.serviceTitle || req.body.serviceName;
    const address = req.body.address;
    const date = req.body.date || req.body.bookingDate;
    const rawSlot = req.body.timeSlot || req.body.slot;
    const timeSlot = rawSlot ? rawSlot.replace(/^Tomorrow\s*/i, '').trim() : '10:00 AM - 12:00 PM';
    const amount = req.body.amount !== undefined ? req.body.amount : req.body.price;

    const cleanPhone = normalizePhone(customerPhone);
    if (!customerName || !cleanPhone || cleanPhone.length !== 10 || !serviceTitle || !address || !address.trim()) {
      return res.status(400).json({ success: false, message: 'Valid customer name, 10-digit phone number, service title, and address are required' });
    }

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

    await query(`
      INSERT INTO \`bookings\` (
        \`id\`, \`customer_id\`, \`customer_name\`, \`customer_phone\`, \`service_title\`, \`address\`, \`date\`, \`time_slot\`,
        \`status\`, \`technician_id\`, \`technician_name\`, \`amount\`, \`payment_status\`, \`tds_before\`, \`tds_after\`
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

    return res.status(201).json({ success: true, message: 'Booking submitted successfully', data: newBooking });
  } catch (error) {
    console.error('[Bookings Controller] CreateBooking Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to create booking', error: error.message });
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, technicianId, technicianName, tdsBefore, tdsAfter, customerPhone, phone, paymentStatus } = req.body;

    let cleanPhone = null;
    if (customerPhone || phone) {
      cleanPhone = normalizePhone(customerPhone || phone);
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ success: false, message: 'Customer mobile number must be exactly 10 digits' });
      }
    }

    let techName = technicianName || null;
    let techId = technicianId;

    if (req.body.unassign || technicianName === 'Unassigned' || technicianId === 'unassigned' || technicianId === null) {
      techId = null;
      techName = 'Unassigned';
    } else if (technicianId) {
      const techRows = await query('SELECT full_name FROM users WHERE id = ? LIMIT 1', [technicianId]);
      if (techRows && techRows.length > 0) {
        techName = techRows[0].full_name;
      }
    }

    const updates = [];
    const params = [];
    if (status) { 
      updates.push('`status` = ?'); 
      params.push(status); 
    } else if (techName && techName !== 'Unassigned') {
      updates.push('`status` = ?'); 
      params.push('Assigned');
    }

    if (tdsBefore !== undefined) { updates.push('`tds_before` = ?'); params.push(tdsBefore); }
    if (tdsAfter !== undefined) { updates.push('`tds_after` = ?'); params.push(tdsAfter); }
    if (technicianId !== undefined || technicianName !== undefined || req.body.unassign) { 
      updates.push('`technician_id` = ?'); 
      params.push(techId); 
      updates.push('`technician_name` = ?'); 
      params.push(techName || 'Unassigned'); 
    }
    if (cleanPhone) { updates.push('`customer_phone` = ?'); params.push(cleanPhone); }
    if (paymentStatus !== undefined) { updates.push('`payment_status` = ?'); params.push(paymentStatus); }

    if (updates.length > 0) {
      params.push(id);
      await query(`UPDATE \`bookings\` SET ${updates.join(', ')} WHERE \`id\` = ?`, params);
    }

    const updatedRows = await query('SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1', [id]);
    if (!updatedRows || updatedRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.json({ success: true, message: 'Booking updated', data: mapRowToBooking(updatedRows[0]) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Database error', error: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const cancellationReason = reason || 'Cancelled by customer';

    await query(
      'UPDATE `bookings` SET `status` = ?, `cancellation_reason` = ? WHERE `id` = ?',
      ['Cancelled', cancellationReason, id]
    );

    const updatedRows = await query('SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1', [id]);
    if (!updatedRows || updatedRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.json({ success: true, message: 'Booking cancelled successfully', data: mapRowToBooking(updatedRows[0]) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Database error', error: error.message });
  }
};

export const rescheduleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, timeSlot } = req.body || {};

    await query('UPDATE `bookings` SET `date` = ?, `time_slot` = ? WHERE `id` = ?', [date, timeSlot, id]);

    const updatedRows = await query('SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1', [id]);
    if (!updatedRows || updatedRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.json({ success: true, message: 'Booking rescheduled successfully', data: mapRowToBooking(updatedRows[0]) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Database error', error: error.message });
  }
};

export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM `bookings` WHERE `id` = ?', [id]);
    return res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Database error', error: error.message });
  }
};

export const getCustomerBookings = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const parts = token.split('.');
    if (parts.length < 2) {
      return res.status(401).json({ success: false, message: 'Invalid session token' });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const customerId = payload.userId || payload.id || payload.sub;

    const userRows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [customerId]);
    const userRecord = userRows && userRows.length > 0 ? userRows[0] : null;
    const userPhone = userRecord ? normalizePhone(userRecord.phone) : '';

    let sql = `
      SELECT * FROM \`bookings\` 
      WHERE (\`customer_id\` = ? OR (? != '' AND \`customer_phone\` LIKE ?))
    `;
    const params = [customerId, userPhone, `%${userPhone}%`];

    const { status } = req.query;
    if (status && status !== 'all') {
      sql += ' AND LOWER(`status`) = ?';
      params.push(status.toLowerCase());
    }

    sql += ' ORDER BY `created_at` DESC';
    const rows = await query(sql, params);
    const mapped = Array.isArray(rows) ? rows.map(mapRowToBooking) : [];

    return res.status(200).json({
      success: true,
      count: mapped.length,
      customerId,
      data: mapped
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve customer bookings', error: error.message });
  }
};

/**
 * Assign a service booking to a technician / staff
 * POST /api/bookings/:id/assign or PATCH /api/bookings/:id/assign
 */
export const assignBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { technicianId, technicianName, status, notes, date, timeSlot } = req.body;

    if (!technicianId && !technicianName) {
      return res.status(400).json({
        success: false,
        message: 'technicianId or technicianName is required to assign this booking'
      });
    }

    // 1. Verify booking exists
    const bookingRows = await query('SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1', [id]);
    if (!bookingRows || bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Booking with ID "${id}" not found`
      });
    }

    const currentBooking = bookingRows[0];
    if (currentBooking.status && currentBooking.status.toLowerCase() === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign a cancelled booking. Please reactivate or reschedule the booking first.'
      });
    }

    // 2. Resolve technician details
    let resolvedTechId = technicianId || null;
    let resolvedTechName = technicianName || null;
    let technicianPhone = null;

    if (technicianId) {
      const userRows = await query('SELECT id, full_name, phone, role FROM `users` WHERE `id` = ? LIMIT 1', [technicianId]);
      if (userRows && userRows.length > 0) {
        resolvedTechId = userRows[0].id;
        resolvedTechName = userRows[0].full_name;
        technicianPhone = userRows[0].phone ? normalizePhone(userRows[0].phone) : null;
      } else if (!technicianName) {
        return res.status(404).json({
          success: false,
          message: `Technician with ID "${technicianId}" not found in database`
        });
      }
    } else if (technicianName) {
      // Lookup by name in users table
      const userRows = await query('SELECT id, full_name, phone, role FROM `users` WHERE LOWER(`full_name`) = LOWER(?) LIMIT 1', [technicianName.trim()]);
      if (userRows && userRows.length > 0) {
        resolvedTechId = userRows[0].id;
        resolvedTechName = userRows[0].full_name;
        technicianPhone = userRows[0].phone ? normalizePhone(userRows[0].phone) : null;
      } else {
        resolvedTechName = technicianName.trim();
      }
    }

    const nextStatus = status || 'Assigned';
    const targetDate = date || currentBooking.date;
    const targetSlot = timeSlot || currentBooking.time_slot;
    const { force, overrideConflict } = req.body;

    // 3. Schedule Conflict / Clash Detection
    let conflictWarning = null;
    if (resolvedTechId || resolvedTechName) {
      const conflictSql = `
        SELECT id, customer_name, service_title, date, time_slot, status 
        FROM \`bookings\` 
        WHERE \`id\` != ? 
          AND (\`technician_id\` = ? OR (\`technician_name\` = ? AND \`technician_name\` != 'Unassigned'))
          AND \`date\` = ? 
          AND \`time_slot\` = ? 
          AND LOWER(\`status\`) NOT IN ('cancelled', 'completed')
        LIMIT 1
      `;
      const conflictRows = await query(conflictSql, [id, resolvedTechId, resolvedTechName, targetDate, targetSlot]);

      if (conflictRows && conflictRows.length > 0) {
        const clash = conflictRows[0];
        conflictWarning = `Assigned (${resolvedTechName} also scheduled for #${clash.id})`;
      }
    }

    // 4. Update the booking in MySQL
    const updates = ['`technician_id` = ?', '`technician_name` = ?', '`status` = ?'];
    const params = [resolvedTechId, resolvedTechName, nextStatus];

    if (date) {
      updates.push('`date` = ?');
      params.push(date);
    }
    if (timeSlot) {
      updates.push('`time_slot` = ?');
      params.push(timeSlot);
    }

    params.push(id);
    await query(`UPDATE \`bookings\` SET ${updates.join(', ')} WHERE \`id\` = ?`, params);

    // 4. Retrieve updated booking
    const updatedRows = await query('SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1', [id]);
    const updatedBooking = mapRowToBooking(updatedRows[0]);

    return res.status(200).json({
      success: true,
      message: conflictWarning 
        ? `Booking #${id} assigned to ${resolvedTechName} (Warning: ${conflictWarning})`
        : `Booking #${id} successfully assigned to ${resolvedTechName}`,
      data: updatedBooking,
      warning: conflictWarning || null,
      assignment: {
        bookingId: id,
        technicianId: resolvedTechId,
        technicianName: resolvedTechName,
        technicianPhone: technicianPhone,
        status: nextStatus,
        assignedAt: new Date().toISOString(),
        notes: notes || null,
        conflictWarning: conflictWarning || null
      }
    });
  } catch (error) {
    console.error('[Bookings Controller] assignBooking Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign booking',
      error: error.message
    });
  }
};

/**
 * Unassign technician from a booking and revert to Pending/Confirmed
 * POST /api/bookings/:id/unassign or PATCH /api/bookings/:id/unassign
 */
export const unassignBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const bookingRows = await query('SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1', [id]);
    if (!bookingRows || bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Booking with ID "${id}" not found`
      });
    }

    const nextStatus = status || 'Pending';

    await query(
      "UPDATE `bookings` SET `technician_id` = NULL, `technician_name` = 'Unassigned', `status` = ? WHERE `id` = ?",
      [nextStatus, id]
    );

    const updatedRows = await query('SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1', [id]);
    const updatedBooking = mapRowToBooking(updatedRows[0]);

    return res.status(200).json({
      success: true,
      message: `Booking #${id} unassigned successfully and reverted to ${nextStatus}`,
      data: updatedBooking
    });
  } catch (error) {
    console.error('[Bookings Controller] unassignBooking Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unassign booking',
      error: error.message
    });
  }
};

/**
 * Bulk assign multiple bookings to a technician
 * POST /api/bookings/bulk-assign
 */
export const bulkAssignBookings = async (req, res) => {
  try {
    const { bookingIds, technicianId, technicianName, status } = req.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'bookingIds must be a non-empty array of booking IDs'
      });
    }

    if (!technicianId && !technicianName) {
      return res.status(400).json({
        success: false,
        message: 'technicianId or technicianName is required for bulk assignment'
      });
    }

    // Resolve technician
    let resolvedTechId = technicianId || null;
    let resolvedTechName = technicianName || null;

    if (technicianId) {
      const userRows = await query('SELECT id, full_name, phone FROM `users` WHERE `id` = ? LIMIT 1', [technicianId]);
      if (userRows && userRows.length > 0) {
        resolvedTechId = userRows[0].id;
        resolvedTechName = userRows[0].full_name;
      }
    } else if (technicianName) {
      const userRows = await query('SELECT id, full_name, phone FROM `users` WHERE LOWER(`full_name`) = LOWER(?) LIMIT 1', [technicianName.trim()]);
      if (userRows && userRows.length > 0) {
        resolvedTechId = userRows[0].id;
        resolvedTechName = userRows[0].full_name;
      } else {
        resolvedTechName = technicianName.trim();
      }
    }

    const nextStatus = status || 'Assigned';
    const placeholders = bookingIds.map(() => '?').join(',');

    await query(
      `UPDATE \`bookings\` 
       SET \`technician_id\` = ?, \`technician_name\` = ?, \`status\` = ? 
       WHERE \`id\` IN (${placeholders}) AND LOWER(\`status\`) != 'cancelled'`,
      [resolvedTechId, resolvedTechName, nextStatus, ...bookingIds]
    );

    const updatedRows = await query(`SELECT * FROM \`bookings\` WHERE \`id\` IN (${placeholders})`, bookingIds);
    const mapped = Array.isArray(updatedRows) ? updatedRows.map(mapRowToBooking) : [];

    return res.status(200).json({
      success: true,
      message: `Successfully assigned ${mapped.length} bookings to ${resolvedTechName}`,
      count: mapped.length,
      technicianId: resolvedTechId,
      technicianName: resolvedTechName,
      data: mapped
    });
  } catch (error) {
    console.error('[Bookings Controller] bulkAssignBookings Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk assign bookings',
      error: error.message
    });
  }
};

/**
 * Get all bookings assigned to a specific technician
 * GET /api/bookings/technician/:technicianId
 */
export const getTechnicianBookings = async (req, res) => {
  try {
    const { technicianId } = req.params;
    const { status } = req.query;

    let sql = 'SELECT * FROM `bookings` WHERE (`technician_id` = ? OR `technician_name` = ?)';
    const params = [technicianId, technicianId];

    if (status && status !== 'all') {
      sql += ' AND LOWER(`status`) = ?';
      params.push(status.toLowerCase());
    }

    sql += ' ORDER BY `created_at` DESC';

    const rows = await query(sql, params);
    const mapped = Array.isArray(rows) ? rows.map(mapRowToBooking) : [];

    return res.status(200).json({
      success: true,
      technicianId,
      count: mapped.length,
      data: mapped
    });
  } catch (error) {
    console.error('[Bookings Controller] getTechnicianBookings Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve technician bookings',
      error: error.message
    });
  }
};
