import { query, isMySQLActive } from '../config/db.js';

// In-memory fallback store
const addressesCache = [];

/**
 * Helper to resolve user ID from Authorization header or body/query
 */
export const resolveUserId = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const parts = token.split('.');
    if (parts.length >= 2) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (payload.userId || payload.id || payload.sub) {
          return payload.userId || payload.id || payload.sub;
        }
      } catch (e) {}
    }
  }
  return req.headers['x-user-id'] || req.query.userId || req.body?.userId || null;
};

/**
 * @route   GET /api/customer/addresses or /api/addresses
 * @desc    Get all saved addresses for the authenticated customer
 * @access  Private (Bearer token)
 */
export const getAddresses = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid session token.'
      });
    }

    if (isMySQLActive()) {
      const rows = await query(
        'SELECT * FROM `addresses` WHERE `user_id` = ? ORDER BY `is_default` DESC, `created_at` DESC',
        [userId]
      );
      const mapped = Array.isArray(rows)
        ? rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            title: r.title || 'Home',
            address: r.address || '',
            city: r.city || '',
            pincode: r.pincode || '',
            isDefault: r.is_default === 1,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }))
        : [];

      return res.status(200).json({
        success: true,
        count: mapped.length,
        userId,
        data: mapped
      });
    }

    // In-memory fallback
    const filtered = addressesCache.filter(a => a.userId === userId);
    return res.status(200).json({
      success: true,
      count: filtered.length,
      userId,
      data: filtered
    });
  } catch (error) {
    console.error('[AddressesController] getAddresses Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve addresses',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/customer/addresses or /api/addresses
 * @desc    Save a new customer address
 * @access  Private (Bearer token)
 */
export const createAddress = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid session token.'
      });
    }

    const { title, address, city, pincode, isDefault } = req.body;

    if (!address || !address.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full address is required'
      });
    }

    const newId = `addr-${Date.now()}`;
    const cleanTitle = (title && title.trim()) ? title.trim() : 'Home';
    const cleanAddress = address.trim();
    const cleanCity = city ? city.trim() : '';
    const cleanPincode = pincode ? pincode.trim() : '';
    const shouldBeDefault = isDefault === true || isDefault === 'true' || isDefault === 1;

    if (isMySQLActive()) {
      // Check existing count for this user
      const existing = await query('SELECT id FROM `addresses` WHERE `user_id` = ?', [userId]);
      const isFirstAddress = !existing || existing.length === 0;
      const makeDefault = shouldBeDefault || isFirstAddress ? 1 : 0;

      // If making default, reset other addresses of this user
      if (makeDefault === 1) {
        await query('UPDATE `addresses` SET `is_default` = 0 WHERE `user_id` = ?', [userId]);
      }

      await query(
        `INSERT INTO \`addresses\` 
         (\`id\`, \`user_id\`, \`title\`, \`address\`, \`city\`, \`pincode\`, \`is_default\`) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, cleanTitle, cleanAddress, cleanCity, cleanPincode, makeDefault]
      );

      const createdRows = await query('SELECT * FROM `addresses` WHERE `id` = ? LIMIT 1', [newId]);
      const r = createdRows && createdRows.length > 0 ? createdRows[0] : null;

      const responseData = {
        id: newId,
        userId,
        title: cleanTitle,
        address: cleanAddress,
        city: cleanCity,
        pincode: cleanPincode,
        isDefault: makeDefault === 1,
        createdAt: r?.created_at || new Date().toISOString()
      };

      return res.status(201).json({
        success: true,
        message: 'Address saved successfully',
        data: responseData
      });
    }

    // In-memory fallback
    const newRecord = {
      id: newId,
      userId,
      title: cleanTitle,
      address: cleanAddress,
      city: cleanCity,
      pincode: cleanPincode,
      isDefault: shouldBeDefault,
      createdAt: new Date().toISOString()
    };
    if (shouldBeDefault) {
      addressesCache.forEach(a => {
        if (a.userId === userId) a.isDefault = false;
      });
    }
    addressesCache.push(newRecord);

    return res.status(201).json({
      success: true,
      message: 'Address saved successfully',
      data: newRecord
    });
  } catch (error) {
    console.error('[AddressesController] createAddress Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save address',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/customer/addresses/:id or /api/addresses/:id
 * @desc    Update an existing address
 * @access  Private (Bearer token)
 */
export const updateAddress = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    const { title, address, city, pincode, isDefault } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (isMySQLActive()) {
      const existing = await query('SELECT * FROM `addresses` WHERE `id` = ? AND `user_id` = ? LIMIT 1', [id, userId]);
      if (!existing || existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Address not found or unauthorized' });
      }

      const prev = existing[0];
      const updatedTitle = title !== undefined ? title.trim() : prev.title;
      const updatedAddress = address !== undefined ? address.trim() : prev.address;
      const updatedCity = city !== undefined ? city.trim() : prev.city;
      const updatedPincode = pincode !== undefined ? pincode.trim() : prev.pincode;
      const makeDefault = isDefault !== undefined ? (isDefault ? 1 : 0) : prev.is_default;

      if (makeDefault === 1) {
        await query('UPDATE `addresses` SET `is_default` = 0 WHERE `user_id` = ?', [userId]);
      }

      await query(
        `UPDATE \`addresses\` 
         SET \`title\` = ?, \`address\` = ?, \`city\` = ?, \`pincode\` = ?, \`is_default\` = ? 
         WHERE \`id\` = ? AND \`user_id\` = ?`,
        [updatedTitle, updatedAddress, updatedCity, updatedPincode, makeDefault, id, userId]
      );

      return res.status(200).json({
        success: true,
        message: 'Address updated successfully',
        data: {
          id,
          userId,
          title: updatedTitle,
          address: updatedAddress,
          city: updatedCity,
          pincode: updatedPincode,
          isDefault: makeDefault === 1
        }
      });
    }

    const idx = addressesCache.findIndex(a => a.id === id && a.userId === userId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    if (isDefault) {
      addressesCache.forEach(a => { if (a.userId === userId) a.isDefault = false; });
    }
    addressesCache[idx] = {
      ...addressesCache[idx],
      title: title || addressesCache[idx].title,
      address: address || addressesCache[idx].address,
      city: city || addressesCache[idx].city,
      pincode: pincode || addressesCache[idx].pincode,
      isDefault: isDefault !== undefined ? Boolean(isDefault) : addressesCache[idx].isDefault
    };

    return res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: addressesCache[idx]
    });
  } catch (error) {
    console.error('[AddressesController] updateAddress Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update address',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/customer/addresses/:id or /api/addresses/:id
 * @desc    Delete a saved address
 * @access  Private (Bearer token)
 */
export const deleteAddress = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (isMySQLActive()) {
      const result = await query('DELETE FROM `addresses` WHERE `id` = ? AND `user_id` = ?', [id, userId]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Address not found or already deleted' });
      }
      return res.status(200).json({
        success: true,
        message: 'Address deleted successfully',
        id
      });
    }

    const idx = addressesCache.findIndex(a => a.id === id && a.userId === userId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    addressesCache.splice(idx, 1);
    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
      id
    });
  } catch (error) {
    console.error('[AddressesController] deleteAddress Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete address',
      error: error.message
    });
  }
};
