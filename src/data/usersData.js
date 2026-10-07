import { isMySQLActive, query } from '../config/db.js';

// Helper to normalize phone number strictly to 10 digits
export const normalizePhone = (phoneStr) => {
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

// In-memory cache synced from MySQL
let usersCache = [];

// Exported active users array
export const users = usersCache;

// Active OTP store: phone -> { otp, expiresAt }
export const otpStore = new Map();

/**
 * Sync in-memory cache from MySQL users table
 */
export async function syncUsersCache() {
  try {
    if (isMySQLActive()) {
      const rows = await query('SELECT * FROM `users` ORDER BY `created_at` DESC');
      if (Array.isArray(rows)) {
        usersCache = rows.map(r => ({
          id: r.id,
          fullName: r.full_name,
          name: r.full_name,
          email: r.email,
          phone: r.phone ? normalizePhone(r.phone) : '',
          password: r.password,
          role: r.role,
          city: r.city,
          location: r.city,
          status: r.is_active === 0 ? 'Inactive' : 'Active',
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
      }
    }
  } catch (err) {
    console.error('[Users Data] Error syncing users cache from MySQL:', err.message);
  }
  return usersCache;
}

export function getAllUsers() {
  return usersCache;
}

/**
 * Save user to MySQL database and update memory cache
 */
export async function saveUserToDatabase(newUser) {
  try {
    if (newUser.phone) {
      newUser.phone = normalizePhone(newUser.phone);
    }

    let assignedRole = 'Customer';
    if (newUser.role && (newUser.role.toLowerCase() === 'admin' || newUser.role.toLowerCase() === 'administrator')) {
      assignedRole = 'Admin';
    } else if (newUser.role && (newUser.role.toLowerCase() === 'technician' || newUser.role.toLowerCase() === 'staff')) {
      assignedRole = 'Technician';
    } else if (newUser.role && newUser.role.toLowerCase() === 'customer') {
      assignedRole = 'Customer';
    } else if (newUser.role === 'Super Admin') {
      assignedRole = 'Super Admin';
    }
    newUser.role = assignedRole;

    const idx = usersCache.findIndex(u => u.id === newUser.id);
    if (idx >= 0) {
      usersCache[idx] = { ...usersCache[idx], ...newUser };
    } else {
      usersCache.push(newUser);
    }

    if (isMySQLActive()) {
      await query(`
        INSERT INTO \`users\` (\`id\`, \`full_name\`, \`email\`, \`phone\`, \`password\`, \`role\`, \`city\`, \`is_active\`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          \`full_name\` = VALUES(\`full_name\`),
          \`email\` = VALUES(\`email\`),
          \`phone\` = VALUES(\`phone\`),
          \`password\` = VALUES(\`password\`),
          \`role\` = VALUES(\`role\`),
          \`city\` = VALUES(\`city\`),
          \`is_active\` = VALUES(\`is_active\`)
      `, [
        newUser.id || `usr-${Date.now()}`,
        newUser.fullName || newUser.name || newUser.full_name || 'Customer',
        (newUser.email || '').trim().toLowerCase(),
        newUser.phone || '',
        newUser.password || '123456',
        newUser.role,
        newUser.city || newUser.location || '',
        newUser.status === 'Inactive' ? 0 : 1
      ]);
    }

    return true;
  } catch (err) {
    console.error('[Users Data] Failed to write user to database:', err.message);
    return false;
  }
}

/**
 * Query created administrators & technicians directly from MySQL
 */
export async function getCreatedAdmins() {
  if (isMySQLActive()) {
    try {
      const rows = await query(`
        SELECT id, full_name, email, phone, role, city, is_active, created_at 
        FROM \`users\` 
        WHERE LOWER(role) IN ('admin', 'technician', 'staff', 'super admin')
        ORDER BY created_at DESC
      `);
      if (Array.isArray(rows)) {
        return rows.map(r => ({
          id: r.id,
          name: r.full_name,
          fullName: r.full_name,
          email: r.email,
          phone: r.phone ? normalizePhone(r.phone) : '',
          specialization: (r.role || '').toLowerCase() === 'technician' ? 'Field Technician' : (r.role === 'Super Admin' ? 'Master Authority' : 'Administrator'),
          role: r.role || 'Technician',
          location: r.city || 'Operations HQ',
          city: r.city || 'Operations HQ',
          status: r.is_active === 0 ? 'Inactive' : 'Active',
          createdAt: r.created_at
        }));
      }
    } catch (e) {
      console.error('[Users Data] MySQL getCreatedAdmins error:', e.message);
    }
  }

  return usersCache
    .filter(u => ['admin', 'technician', 'staff', 'super admin'].includes((u.role || '').toLowerCase()))
    .map(u => ({
      id: u.id,
      name: u.fullName || u.name,
      fullName: u.fullName || u.name,
      email: u.email,
      phone: u.phone ? normalizePhone(u.phone) : '',
      specialization: (u.role || '').toLowerCase() === 'technician' ? 'Field Technician' : (u.role === 'Super Admin' ? 'Master Authority' : 'Administrator'),
      role: u.role || 'Technician',
      location: u.city || u.location || 'Operations HQ',
      city: u.city || u.location || 'Operations HQ',
      status: u.status || 'Active',
      createdAt: u.createdAt
    }));
}

/**
 * Get single user by ID from MySQL
 */
export async function getUserById(id) {
  if (isMySQLActive()) {
    try {
      const rows = await query('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [id]);
      if (rows && rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          fullName: r.full_name,
          name: r.full_name,
          email: r.email,
          phone: r.phone ? normalizePhone(r.phone) : '',
          password: r.password,
          role: r.role,
          city: r.city,
          location: r.city,
          status: r.is_active === 0 ? 'Inactive' : 'Active',
          createdAt: r.created_at,
          updatedAt: r.updated_at
        };
      }
    } catch (e) {
      console.error('[Users Data] MySQL getUserById error:', e.message);
    }
  }

  return usersCache.find(u => u.id === id) || null;
}

/**
 * Update an existing user in MySQL
 */
export async function updateUserInDatabase(id, updates) {
  try {
    let existingUser = await getUserById(id);
    if (!existingUser) {
      return null;
    }

    if (id === 'usr-superadmin' && updates.role && updates.role !== 'Super Admin') {
      throw new Error('Super Admin role cannot be modified');
    }

    let cleanPhone = existingUser.phone;
    if (updates.phone !== undefined && updates.phone !== null && updates.phone.toString().trim() !== '') {
      cleanPhone = normalizePhone(updates.phone);
      if (cleanPhone.length !== 10) {
        throw new Error('Mobile number must be exactly 10 digits');
      }
    }

    const updatedUser = {
      ...existingUser,
      fullName: updates.fullName !== undefined ? updates.fullName.trim() : (existingUser.fullName || existingUser.name),
      name: updates.fullName !== undefined ? updates.fullName.trim() : (existingUser.name || existingUser.fullName),
      email: updates.email !== undefined ? updates.email.trim().toLowerCase() : existingUser.email,
      phone: cleanPhone,
      city: updates.city !== undefined ? updates.city.trim() : (existingUser.city || existingUser.location),
      location: updates.city !== undefined ? updates.city.trim() : (existingUser.location || existingUser.city),
      role: updates.role || existingUser.role || 'Customer',
      status: updates.status || existingUser.status || 'Active',
      updatedAt: new Date().toISOString()
    };

    if (updates.password && updates.password.trim().length >= 6) {
      updatedUser.password = updates.password.trim();
    }

    const idx = usersCache.findIndex(u => u.id === id);
    if (idx >= 0) {
      usersCache[idx] = updatedUser;
    } else {
      usersCache.push(updatedUser);
    }

    if (isMySQLActive()) {
      if (updates.password && updates.password.trim().length >= 6) {
        await query(`
          UPDATE \`users\` 
          SET \`full_name\` = ?, \`email\` = ?, \`phone\` = ?, \`city\` = ?, \`role\` = ?, \`is_active\` = ?, \`password\` = ?
          WHERE \`id\` = ?
        `, [
          updatedUser.fullName,
          updatedUser.email,
          updatedUser.phone,
          updatedUser.city,
          updatedUser.role,
          updatedUser.status === 'Active' ? 1 : 0,
          updatedUser.password,
          id
        ]);
      } else {
        await query(`
          UPDATE \`users\` 
          SET \`full_name\` = ?, \`email\` = ?, \`phone\` = ?, \`city\` = ?, \`role\` = ?, \`is_active\` = ?
          WHERE \`id\` = ?
        `, [
          updatedUser.fullName,
          updatedUser.email,
          updatedUser.phone,
          updatedUser.city,
          updatedUser.role,
          updatedUser.status === 'Active' ? 1 : 0,
          id
        ]);
      }
    }

    return updatedUser;
  } catch (err) {
    console.error('[Users Data] Error updating user:', err.message);
    throw err;
  }
}

/**
 * Delete a user from MySQL
 */
export async function deleteUserFromDatabase(id) {
  try {
    if (id === 'usr-superadmin') {
      throw new Error('Super Admin account cannot be deleted');
    }

    const targetUser = await getUserById(id);
    if (!targetUser) {
      return null;
    }

    if (targetUser.role === 'Super Admin') {
      throw new Error('Super Admin account cannot be deleted');
    }

    const idx = usersCache.findIndex(u => u.id === id);
    if (idx >= 0) {
      usersCache.splice(idx, 1);
    }

    if (isMySQLActive()) {
      await query('DELETE FROM \`users\` WHERE \`id\` = ?', [id]);

      // Release any inventory allocated to this admin in MySQL
      try {
        const invRows = await query('SELECT `id`, `stock_quantity`, `assignments` FROM `inventory`');
        if (Array.isArray(invRows)) {
          for (const row of invRows) {
            let assignments = [];
            try {
              assignments = typeof row.assignments === 'string' ? JSON.parse(row.assignments) : (row.assignments || []);
            } catch (e) { assignments = []; }

            const matching = assignments.filter(
              a => a.adminId === id || (targetUser.email && a.adminEmail?.toLowerCase() === targetUser.email.toLowerCase())
            );

            if (matching.length > 0) {
              const returnedQty = matching.reduce((sum, a) => sum + (Number(a.quantity) || 1), 0);
              const updatedAssignments = assignments.filter(
                a => a.adminId !== id && (!targetUser.email || a.adminEmail?.toLowerCase() !== targetUser.email.toLowerCase())
              );
              const newQty = (Number(row.stock_quantity) || 0) + returnedQty;

              await query('UPDATE `inventory` SET `stock_quantity` = ?, `assignments` = ? WHERE `id` = ?', [
                newQty,
                JSON.stringify(updatedAssignments),
                row.id
              ]);
            }
          }
        }
      } catch (invErr) {
        console.warn('[Users Data] Error releasing inventory assignments from MySQL:', invErr.message);
      }
    }

    return targetUser;
  } catch (err) {
    console.error('[Users Data] Error deleting user:', err.message);
    throw err;
  }
}

/**
 * Query all registered users across all roles directly from MySQL
 */
export async function getAllUsersFromDatabase() {
  if (isMySQLActive()) {
    try {
      const rows = await query(`
        SELECT id, full_name, email, phone, role, city, is_active, created_at, updated_at
        FROM \`users\`
        ORDER BY 
          CASE 
            WHEN role = 'Super Admin' THEN 1
            WHEN role = 'Admin' THEN 2
            ELSE 3
          END ASC,
          created_at DESC
      `);
      if (Array.isArray(rows)) {
        return rows.map(r => ({
          id: r.id,
          name: r.full_name,
          fullName: r.full_name,
          email: r.email,
          phone: r.phone ? normalizePhone(r.phone) : '',
          role: r.role || 'Customer',
          location: r.city || 'Operations HQ',
          city: r.city || 'Operations HQ',
          status: r.is_active === 0 ? 'Inactive' : 'Active',
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
      }
    } catch (e) {
      console.error('[Users Data] MySQL getAllUsersFromDatabase error:', e.message);
    }
  }

  return usersCache.map(u => ({
    id: u.id,
    name: u.fullName || u.name,
    fullName: u.fullName || u.name,
    email: u.email,
    phone: u.phone ? normalizePhone(u.phone) : '',
    role: u.role || 'Customer',
    location: u.city || u.location || 'Operations HQ',
    city: u.city || u.location || 'Operations HQ',
    status: u.status || 'Active',
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  }));
}
