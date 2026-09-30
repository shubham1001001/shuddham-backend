import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isMySQLActive, query } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'database_users.json');

// Initial seed accounts: ONLY Super Admin
const initialSeedUsers = [
  {
    id: 'usr-superadmin',
    fullName: 'Super Admin',
    phone: '9800011100',
    email: 'superadmin@gmail.com',
    password: '123456',
    city: 'HQ Executive Office',
    role: 'Super Admin',
    isProvisioned: false,
    createdAt: '2026-08-01T09:00:00.000Z'
  }
];

/**
 * Load users from disk database file or initialize with seed accounts
 */
function loadUsersFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialSeedUsers, null, 2), 'utf-8');
      console.log(`[Database File] Initialized persistent user database at ${DB_FILE}`);
      return [...initialSeedUsers];
    }

    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Keep Super Admin and all admins created by Super Admin (isProvisioned: true)
      const sanitized = parsed.filter(u => 
        u.isProvisioned === true || u.id === 'usr-superadmin'
      );
      if (sanitized.length !== parsed.length) {
        fs.writeFileSync(DB_FILE, JSON.stringify(sanitized, null, 2), 'utf-8');
        console.log(`[Database File] Purged unprovisioned demo accounts from ${DB_FILE}`);
      }
      console.log(`[Database File] Loaded ${sanitized.length} authorized users from persistent database`);
      return sanitized;
    }

    return [...initialSeedUsers];
  } catch (err) {
    console.error('[Database File] Error reading persistent database:', err.message);
    return [...initialSeedUsers];
  }
}

// Active in-memory users array, initialized from disk database
export const users = loadUsersFromDisk();

// Active OTP store: phone -> { otp, expiresAt }
export const otpStore = new Map();

export function getAllUsers() {
  return loadUsersFromDisk();
}

/**
 * Save user to disk database and update memory store
 */
export function saveUserToDatabase(newUser) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const currentUsers = loadUsersFromDisk();
    const idx = currentUsers.findIndex(u => u.id === newUser.id);
    if (idx >= 0) {
      currentUsers[idx] = { ...currentUsers[idx], ...newUser };
    } else {
      currentUsers.push(newUser);
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(currentUsers, null, 2), 'utf-8');
    console.log(`[Database File] User "${newUser.fullName || newUser.full_name}" stored permanently in database (${DB_FILE})`);

    // Also persist directly into MySQL
    if (isMySQLActive()) {
      query(`
        INSERT INTO users (id, full_name, email, phone, password, role, city, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          full_name = VALUES(full_name),
          phone = VALUES(phone),
          password = VALUES(password),
          role = VALUES(role),
          city = VALUES(city),
          is_active = VALUES(is_active)
      `, [
        newUser.id || `usr-${Date.now()}`,
        newUser.fullName || newUser.name || newUser.full_name || 'Admin',
        (newUser.email || '').trim().toLowerCase(),
        newUser.phone || '',
        newUser.password || '123456',
        newUser.role || 'Admin',
        newUser.city || newUser.location || 'Indore , Madhypradesh',
        newUser.status === 'Inactive' ? 0 : 1
      ]).catch(e => console.warn('[UsersData] MySQL saveUser async error:', e.message));
    }

    return true;
  } catch (err) {
    console.error('[Database File] Failed to write user to database:', err.message);
    return false;
  }
}

/**
 * Query created administrators from MySQL (if active) or disk database
 */
export async function getCreatedAdmins() {
  // 1. If MySQL is active, retrieve all created Admins from MySQL database
  if (isMySQLActive()) {
    try {
      const rows = await query(`
        SELECT id, full_name, email, phone, role, city, created_at 
        FROM users 
        WHERE role = 'Admin' AND id != 'usr-superadmin'
        ORDER BY created_at DESC
      `);
      if (rows && rows.length > 0) {
        return rows.map(r => ({
          id: r.id,
          name: r.full_name,
          email: r.email,
          phone: r.phone,
          specialization: 'Administrator',
          role: r.role,
          location: r.city || 'Operations HQ',
          status: 'Active',
          createdAt: r.created_at
        }));
      }
    } catch (e) {
      console.warn('[TechniciansController] MySQL query fallback:', e.message);
    }
  }

  // 2. Persistent file database store
  const allUsers = loadUsersFromDisk();
  const createdAdmins = allUsers.filter(u => 
    (u.isProvisioned === true || u.id !== 'usr-superadmin') && 
    (u.role === 'Admin')
  );

  return createdAdmins.map(u => ({
    id: u.id,
    name: u.fullName || u.full_name,
    email: u.email,
    phone: u.phone,
    specialization: 'Administrator',
    role: u.role,
    location: u.city || 'Operations HQ',
    status: u.status || 'Active',
    createdAt: u.createdAt || u.created_at
  }));
}

/**
 * Get single user by ID from MySQL or disk
 */
export async function getUserById(id) {
  if (isMySQLActive()) {
    try {
      const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
      if (rows && rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          fullName: r.full_name,
          name: r.full_name,
          email: r.email,
          phone: r.phone,
          role: r.role,
          city: r.city,
          location: r.city,
          status: r.is_active ? 'Active' : 'Inactive',
          createdAt: r.created_at,
          updatedAt: r.updated_at
        };
      }
    } catch (e) {
      console.warn('[UsersData] MySQL getUserById fallback:', e.message);
    }
  }

  const allUsers = loadUsersFromDisk();
  return allUsers.find(u => u.id === id) || null;
}

/**
 * Update an existing administrator/user in persistent store and MySQL
 */
export async function updateUserInDatabase(id, updates) {
  try {
    const currentUsers = loadUsersFromDisk();
    const idx = currentUsers.findIndex(u => u.id === id);
    if (idx === -1) {
      return null;
    }

    const existingUser = currentUsers[idx];

    // Protect primary Super Admin role
    if (id === 'usr-superadmin' && updates.role && updates.role !== 'Super Admin') {
      throw new Error('Super Admin role cannot be modified');
    }

    const updatedUser = {
      ...existingUser,
      fullName: updates.fullName !== undefined ? updates.fullName.trim() : (existingUser.fullName || existingUser.name),
      name: updates.fullName !== undefined ? updates.fullName.trim() : (existingUser.name || existingUser.fullName),
      email: updates.email !== undefined ? updates.email.trim().toLowerCase() : existingUser.email,
      phone: updates.phone !== undefined ? updates.phone.trim() : existingUser.phone,
      city: updates.city !== undefined ? updates.city.trim() : (existingUser.city || existingUser.location),
      location: updates.city !== undefined ? updates.city.trim() : (existingUser.location || existingUser.city),
      role: updates.role || existingUser.role || 'Admin',
      status: updates.status || existingUser.status || 'Active',
      updatedAt: new Date().toISOString()
    };

    if (updates.password && updates.password.trim().length >= 6) {
      updatedUser.password = updates.password.trim();
    }

    currentUsers[idx] = updatedUser;
    fs.writeFileSync(DB_FILE, JSON.stringify(currentUsers, null, 2), 'utf-8');

    // Update MySQL if active
    if (isMySQLActive()) {
      try {
        if (updates.password && updates.password.trim().length >= 6) {
          await query(`
            UPDATE users 
            SET full_name = ?, email = ?, phone = ?, city = ?, role = ?, is_active = ?, password = ?
            WHERE id = ?
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
            UPDATE users 
            SET full_name = ?, email = ?, phone = ?, city = ?, role = ?, is_active = ?
            WHERE id = ?
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
      } catch (err) {
        console.warn('[UsersData] MySQL update user fallback:', err.message);
      }
    }

    console.log(`[Database File] User "${updatedUser.fullName}" (ID: ${id}) updated in database`);
    return updatedUser;
  } catch (err) {
    console.error('[UsersData] Error updating user:', err.message);
    throw err;
  }
}

/**
 * Delete an administrator/user from persistent store and MySQL
 */
export async function deleteUserFromDatabase(id) {
  try {
    if (id === 'usr-superadmin') {
      throw new Error('Super Admin account cannot be deleted');
    }

    const currentUsers = loadUsersFromDisk();
    const idx = currentUsers.findIndex(u => u.id === id);
    if (idx === -1) {
      return null;
    }

    const targetUser = currentUsers[idx];
    if (targetUser.role === 'Super Admin') {
      throw new Error('Super Admin account cannot be deleted');
    }

    // Remove from in-memory and disk file
    const deletedUser = currentUsers.splice(idx, 1)[0];
    fs.writeFileSync(DB_FILE, JSON.stringify(currentUsers, null, 2), 'utf-8');

    // Delete from MySQL
    if (isMySQLActive()) {
      try {
        await query('DELETE FROM users WHERE id = ?', [id]);
      } catch (err) {
        console.warn('[UsersData] MySQL delete user fallback:', err.message);
      }
    }

    // Automatically release any inventory equipment assigned to this admin back to central stock
    try {
      const INVENTORY_FILE = path.join(DATA_DIR, 'database_inventory.json');
      if (fs.existsSync(INVENTORY_FILE)) {
        const rawInv = fs.readFileSync(INVENTORY_FILE, 'utf-8');
        const items = JSON.parse(rawInv);
        if (Array.isArray(items)) {
          let modified = false;
          items.forEach(item => {
            if (Array.isArray(item.assignments)) {
              const matchingAssignments = item.assignments.filter(
                a => a.adminId === id || (targetUser.email && a.adminEmail?.toLowerCase() === targetUser.email.toLowerCase())
              );
              if (matchingAssignments.length > 0) {
                const totalReturned = matchingAssignments.reduce((sum, a) => sum + (Number(a.quantity) || 1), 0);
                item.stockQuantity = (Number(item.stockQuantity) || 0) + totalReturned;
                item.assignments = item.assignments.filter(
                  a => a.adminId !== id && (!targetUser.email || a.adminEmail?.toLowerCase() !== targetUser.email.toLowerCase())
                );
                modified = true;
              }
            }
          });
          if (modified) {
            fs.writeFileSync(INVENTORY_FILE, JSON.stringify(items, null, 2), 'utf-8');
            console.log(`[UsersData] Released allocated devices for deleted Admin ${id} back to warehouse stock`);
          }
        }
      }
    } catch (invErr) {
      console.warn('[UsersData] Error releasing inventory assignments:', invErr.message);
    }

    console.log(`[Database File] User "${deletedUser.fullName || deletedUser.name}" (ID: ${id}) deleted from database`);
    return deletedUser;
  } catch (err) {
    console.error('[UsersData] Error deleting user:', err.message);
    throw err;
  }
}

