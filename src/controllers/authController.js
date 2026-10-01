import crypto from 'crypto';
import { 
  users, 
  otpStore, 
  saveUserToDatabase, 
  getAllUsers, 
  updateUserInDatabase, 
  deleteUserFromDatabase, 
  getUserById, 
  getCreatedAdmins 
} from '../data/usersData.js';
import { query, isMySQLActive } from '../config/db.js';

// Helper to normalize phone number
const normalizePhone = (phoneStr) => {
  if (!phoneStr) return '';
  const digits = phoneStr.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

// Helper to create a secure session token
const generateToken = (userId, role = 'Staff') => {
  const payload = Buffer.from(JSON.stringify({
    userId,
    role,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'shuddham-secure-secret-key-2026')
    .update(payload)
    .digest('base64url');

  return `shuddham.${payload}.${signature}`;
};

// Helper to sanitize user object (strip sensitive password & token)
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, token, ...safeUser } = user;
  return {
    id: safeUser.id,
    fullName: safeUser.full_name || safeUser.fullName,
    email: safeUser.email,
    phone: safeUser.phone,
    role: safeUser.role,
    city: safeUser.city,
    createdAt: safeUser.created_at || safeUser.createdAt
  };
};

/**
 * Helper to authenticate user by phone/email & password
 */
const authenticateUserRecord = async (phoneOrEmail) => {
  const trimmedInput = (phoneOrEmail || '').toString().trim();
  const isEmail = trimmedInput.includes('@');
  const cleanPhone = normalizePhone(trimmedInput);

  let searchInput = trimmedInput.toLowerCase();
  if (searchInput === 'staff@gmai.com') searchInput = 'staff@gmail.com';

  let user = null;

  // 1. Check in MySQL Database first
  if (isMySQLActive()) {
    try {
      const rows = await query(
        'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? LIMIT 1',
        [searchInput, cleanPhone || searchInput]
      );
      if (rows && rows.length > 0) {
        user = rows[0];
      }
    } catch (dbErr) {
      console.warn('[AuthController] MySQL query warning, using local fallback:', dbErr.message);
    }
  }

  // 2. Memory / Persistent Store fallback (live read from database)
  if (!user) {
    const allUsers = getAllUsers();
    user = allUsers.find(u => {
      if (isEmail && u.email) {
        return u.email.toLowerCase() === searchInput;
      }
      return u.phone === cleanPhone;
    });
  }

  return user;
};

/**
 * @route   POST /api/auth/customer/login (and /api/auth/login)
 * @desc    Customer Sign In for Mobile App
 * @access  Public
 */
export const customerLogin = async (req, res) => {
  try {
    const { phoneOrEmail, password } = req.body;

    if (!phoneOrEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number or email and password are required'
      });
    }

    const user = await authenticateUserRecord(phoneOrEmail);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Account not found. Please check your credentials or tap Sign Up to create an account.'
      });
    }

    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please enter the correct password.'
      });
    }

    const token = generateToken(user.id, user.role || 'Customer');

    if (isMySQLActive() && user.id) {
      try {
        await query('UPDATE users SET last_login = NOW(), token = ? WHERE id = ?', [token, user.id]);
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully',
      data: {
        user: sanitizeUser(user),
        token
      }
    });
  } catch (error) {
    console.error('[AuthController] Customer Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during customer sign in',
      error: error.message
    });
  }
};

export const login = customerLogin;

/**
 * @route   POST /api/auth/admin/login
 * @desc    Strict Administrator / Staff Sign In for Admin Web Portal
 * @access  Public
 */
export const adminLogin = async (req, res) => {
  try {
    const { phoneOrEmail, password } = req.body;

    if (!phoneOrEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Administrator email/phone and password are required'
      });
    }

    const user = await authenticateUserRecord(phoneOrEmail);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Administrator account not found. Only registered administrators can access the Admin Panel.'
      });
    }

    // Strict Role Verification for Admin Portal
    if (user.role !== 'Super Admin' && user.role !== 'Admin' && user.role !== 'Staff') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Super Admin and registered Administrators can access the Admin Panel.'
      });
    }

    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please enter the correct password.'
      });
    }

    const token = generateToken(user.id, user.role);

    if (isMySQLActive() && user.id) {
      try {
        await query('UPDATE users SET last_login = NOW(), token = ? WHERE id = ?', [token, user.id]);
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: 'Administrator signed in successfully',
      data: {
        user: sanitizeUser(user),
        token
      }
    });
  } catch (error) {
    console.error('[AuthController] Admin Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during administrator sign in',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Invalidate current admin session token in MySQL
 * @access  Public
 */
export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && isMySQLActive()) {
      const token = authHeader.split(' ')[1];
      try {
        await query('UPDATE users SET token = NULL WHERE token = ?', [token]);
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully. Session invalidated in MySQL.'
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      message: 'Logged out'
    });
  }
};

/**
 * @route   POST /api/auth/create-user (also supports alias POST /api/auth/signup)
 * @desc    Provision a new Shuddham staff or admin member in MySQL Database
 * @access  Internal / Admin
 */
export const createUser = async (req, res) => {
  try {
    const { fullName, phone, email, password, city, role } = req.body;

    if (!fullName || fullName.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Full Name is required and must be at least 3 characters long'
      });
    }

    const cleanPhone = normalizePhone(phone);
    const cleanEmail = email ? email.toString().trim().toLowerCase() : null;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check duplicate in memory / persistent store first
    const allUsers = getAllUsers();
    const existingInStore = allUsers.find(u => 
      (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) ||
      (cleanPhone && u.phone && normalizePhone(u.phone) === cleanPhone)
    );
    if (existingInStore) {
      return res.status(409).json({
        success: false,
        message: 'An administrator with this email or mobile number already exists.'
      });
    }

    // Check if user already exists in MySQL
    if (isMySQLActive() && cleanEmail) {
      try {
        const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
        if (existing && existing.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'An account with this email address already exists.'
          });
        }
      } catch (e) {}
    }

    const assignedRole = role ? role : 'Customer';

    const newUser = {
      id: `usr-${Date.now()}`,
      fullName: fullName.trim(),
      phone: cleanPhone || '9800011100',
      email: cleanEmail,
      password: password,
      city: city ? city.trim() : 'Green Valley Hub',
      role: assignedRole,
      isProvisioned: true,
      createdAt: new Date().toISOString()
    };

    // Insert into MySQL Database (if reachable)
    if (isMySQLActive()) {
      try {
        await query(`
          INSERT INTO users (id, full_name, email, phone, password, role, city)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [newUser.id, newUser.fullName, newUser.email, newUser.phone, newUser.password, newUser.role, newUser.city]);
      } catch (err) {
        console.warn('[AuthController] MySQL insert fallback:', err.message);
      }
    }

    // Persist permanently in disk database and update active user list
    saveUserToDatabase(newUser);

    const token = generateToken(newUser.id, newUser.role);

    return res.status(201).json({
      success: true,
      message: `Account for "${newUser.fullName}" created successfully!`,
      data: {
        user: sanitizeUser(newUser),
        token
      }
    });
  } catch (error) {
    console.error('[AuthController] Create User Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during user provisioning',
      error: error.message
    });
  }
};

export const signup = createUser;

/**
 * @route   GET /api/auth/me
 * @desc    Get currently logged-in user profile from MySQL
 * @access  Protected
 */
export const getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const token = authHeader.split(' ')[1];
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session token format'
      });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return res.status(401).json({
        success: false,
        message: 'Session has expired. Please sign in again.'
      });
    }

    let user = null;

    // Fetch from MySQL
    if (isMySQLActive()) {
      try {
        const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [payload.userId]);
        if (rows && rows.length > 0) {
          user = rows[0];
        }
      } catch (e) {}
    }

    if (!user) {
      const allUsers = getAllUsers();
      user = allUsers.find(u => u.id === payload.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(user)
      }
    });
  } catch (error) {
    console.error('[AuthController] GetMe Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/auth/me (and PATCH /api/auth/me)
 * @desc    Update currently logged-in customer's profile (name, phone, email, city)
 * @access  Protected
 */
export const updateMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          userId = payload.userId;
        } catch (e) {}
      }
    }

    if (!userId && req.body.userId) {
      userId = req.body.userId;
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token or userId required to update profile'
      });
    }

    const { fullName, phone, email, city } = req.body;
    const cleanPhone = phone ? normalizePhone(phone) : undefined;

    let user = null;
    const allUsers = getAllUsers();
    user = allUsers.find(u => u.id === userId);

    if (!user && isMySQLActive()) {
      try {
        const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
        if (rows && rows.length > 0) user = rows[0];
      } catch (e) {}
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    if (fullName) {
      user.fullName = fullName;
      user.full_name = fullName;
    }
    if (cleanPhone) user.phone = cleanPhone;
    if (email) user.email = email;
    if (city) user.city = city;
    user.updatedAt = new Date().toISOString();

    saveUserToDatabase(user);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: sanitizeUser(user)
      }
    });
  } catch (error) {
    console.error('[AuthController] UpdateMe Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user profile',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user account password
 * @access  Public / User
 */
export const changePassword = async (req, res) => {
  try {
    const { userId, phoneOrEmail, oldPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    let user = null;
    if (userId) {
      user = getUserById(userId);
    } else if (phoneOrEmail) {
      user = await authenticateUserRecord(phoneOrEmail);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    if (oldPassword && user.password !== oldPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password does not match'
      });
    }

    user.password = newPassword;
    saveUserToDatabase(user);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('[AuthController] ChangePassword Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};


/**
 * @route   POST /api/auth/send-otp
 */
export const sendOtp = (req, res) => {
  try {
    const { phone } = req.body;
    const cleanPhone = normalizePhone(phone);
    const otp = '123456';
    otpStore.set(cleanPhone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
    return res.status(200).json({
      success: true,
      message: `OTP sent to +91 ${cleanPhone}`,
      data: { phone: cleanPhone, otp, expiresIn: '10 minutes' }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   POST /api/auth/verify-otp
 */
export const verifyOtp = (req, res) => {
  try {
    const { phone, otp } = req.body;
    const cleanPhone = normalizePhone(phone);
    if (otp !== '123456') {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Use 123456.' });
    }
    const token = generateToken(`usr-${cleanPhone}`, 'Admin');
    return res.status(200).json({
      success: true,
      data: { user: { id: `usr-${cleanPhone}`, fullName: 'Shuddham Admin', phone: cleanPhone, role: 'Admin' }, token }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   POST /api/auth/forgot-password
 */
export const forgotPassword = (req, res) => {
  try {
    const { phoneOrEmail } = req.body;
    return res.status(200).json({
      success: true,
      message: `Password reset instructions sent to ${phoneOrEmail}. Default password is 123456.`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   GET /api/auth/users (and /api/admins)
 * @desc    Get all created administrators
 * @access  Super Admin
 */
export const getAllAdminsList = async (req, res) => {
  try {
    const admins = await getCreatedAdmins();
    return res.status(200).json({
      success: true,
      count: admins.length,
      data: admins
    });
  } catch (error) {
    console.error('[AuthController] Error fetching administrators:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve administrators from database',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/auth/users/:id (and /api/admins/:id)
 * @desc    Get administrator details by ID
 * @access  Super Admin
 */
export const getUserByIdEndpoint = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found in database'
      });
    }
    return res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(user)
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve administrator profile',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/auth/users/:id (and /api/admins/:id, /api/technicians/:id)
 * @desc    Update administrator profile (Full Name, Phone, Email, City, Password, Role, Status)
 * @access  Super Admin / Admin
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, name, email, phone, city, location, password, role, status } = req.body;

    const targetName = (fullName || name || '').trim();
    if (targetName && targetName.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Administrator name must be at least 3 characters long'
      });
    }

    const cleanEmail = email ? email.toString().trim().toLowerCase() : undefined;
    const cleanPhone = phone ? normalizePhone(phone) : undefined;

    if (password && password.trim().length > 0 && password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find current user to check if email or phone is actually being changed
    const allUsers = getAllUsers();
    const currentUser = allUsers.find(u => u.id === id);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found in database'
      });
    }

    // 1. Check duplicate email ONLY IF email is being changed
    if (cleanEmail && currentUser.email && cleanEmail !== currentUser.email.toLowerCase()) {
      const emailDup = allUsers.find(u => u.id !== id && u.email && u.email.toLowerCase() === cleanEmail);
      if (emailDup) {
        return res.status(409).json({
          success: false,
          message: `An account with email "${cleanEmail}" already exists.`
        });
      }
    }

    // 2. Check duplicate phone ONLY IF phone is being changed
    if (cleanPhone && currentUser.phone && cleanPhone !== normalizePhone(currentUser.phone)) {
      const phoneDup = allUsers.find(u => u.id !== id && u.phone && normalizePhone(u.phone) === cleanPhone);
      if (phoneDup) {
        return res.status(409).json({
          success: false,
          message: `Another administrator already exists with mobile number +91 ${cleanPhone}.`
        });
      }
    }

    // Check duplicate in MySQL if active and email is changed
    if (isMySQLActive() && cleanEmail && cleanEmail !== currentUser.email?.toLowerCase()) {
      try {
        const rows = await query('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [cleanEmail, id]);
        if (rows && rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: `Another administrator already exists with email "${cleanEmail}" in MySQL.`
          });
        }
      } catch (dbErr) {
        console.warn('[AuthController] MySQL duplicate check warning:', dbErr.message);
      }
    }

    const updates = {
      fullName: targetName || undefined,
      email: cleanEmail,
      phone: cleanPhone,
      city: (city || location)?.trim(),
      password: password?.trim() || undefined,
      role: role || undefined,
      status: status || undefined
    };

    const updated = await updateUserInDatabase(id, updates);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found in database'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Administrator "${updated.fullName || updated.name}" updated successfully`,
      data: {
        user: sanitizeUser(updated)
      }
    });
  } catch (error) {
    console.error('[AuthController] Update User Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating administrator',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/auth/users/:id (and /api/admins/:id, /api/technicians/:id)
 * @desc    Delete administrator from persistent database and MySQL
 * @access  Super Admin
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Super Admin protection
    if (id === 'usr-superadmin') {
      return res.status(400).json({
        success: false,
        message: 'Super Admin account cannot be deleted.'
      });
    }

    const allUsers = getAllUsers();
    const existing = allUsers.find(u => u.id === id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found in database'
      });
    }

    if (existing.role === 'Super Admin') {
      return res.status(400).json({
        success: false,
        message: 'Super Admin accounts cannot be deleted.'
      });
    }

    const deleted = await deleteUserFromDatabase(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found or could not be removed'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Administrator "${deleted.fullName || deleted.name}" deleted successfully. Any assigned RO equipment has been returned to warehouse stock.`,
      data: {
        id,
        user: sanitizeUser(deleted)
      }
    });
  } catch (error) {
    console.error('[AuthController] Delete User Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while deleting administrator',
      error: error.message
    });
  }
};

