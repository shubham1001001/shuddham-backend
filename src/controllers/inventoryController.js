import { query, isMySQLActive } from '../config/db.js';

/**
 * Async Category Loader (Pure MySQL)
 */
async function loadCategories() {
  if (isMySQLActive()) {
    try {
      const rows = await query('SELECT * FROM `device_categories` ORDER BY `created_at` ASC');
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        icon: r.icon || 'Box',
        createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }));
    } catch (err) {
      console.error('[Category DB] MySQL read failed:', err.message);
    }
  }
  return [];
}

/**
 * Async Category Saver (Pure MySQL)
 */
async function saveCategory(cat) {
  if (isMySQLActive()) {
    try {
      await query(`
        INSERT INTO \`device_categories\` (\`id\`, \`name\`, \`description\`, \`icon\`)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          \`name\` = VALUES(\`name\`),
          \`description\` = VALUES(\`description\`),
          \`icon\` = VALUES(\`icon\`);
      `, [cat.id, cat.name, cat.description || '', cat.icon || 'Box']);
    } catch (err) {
      console.error('[Category DB] MySQL save error:', err.message);
    }
  }
}

async function deleteCategoryFromDb(id) {
  if (isMySQLActive()) {
    try {
      await query('DELETE FROM `device_categories` WHERE `id` = ?', [id]);
    } catch (err) {
      console.error('[Category DB] MySQL delete error:', err.message);
    }
  }
}

/**
 * Async Inventory Loader (Pure MySQL)
 */
async function loadInventory() {
  if (isMySQLActive()) {
    try {
      const rows = await query('SELECT * FROM `inventory` ORDER BY `created_at` DESC');
      return rows.map(r => {
        let availableSerials = [];
        let assignments = [];
        try {
          if (r.available_serials) availableSerials = typeof r.available_serials === 'string' ? JSON.parse(r.available_serials) : r.available_serials;
        } catch (e) { availableSerials = []; }
        try {
          if (r.assignments) assignments = typeof r.assignments === 'string' ? JSON.parse(r.assignments) : r.assignments;
        } catch (e) { assignments = []; }

        return {
          id: r.id,
          sku: r.sku,
          name: r.name,
          category: r.category,
          stockQuantity: Number(r.stock_quantity) || 0,
          minThreshold: Number(r.min_threshold) || 5,
          unit: r.unit || 'Units',
          costPrice: Number(r.cost_price) || 0,
          sellingPrice: Number(r.selling_price) || 0,
          location: r.location || 'Warehouse Bay 1',
          supplier: r.supplier || 'Shuddham Manufacturing',
          lastRestocked: r.last_restocked || new Date().toISOString().split('T')[0],
          availableSerials: Array.isArray(availableSerials) ? availableSerials : [],
          assignments: Array.isArray(assignments) ? assignments : [],
          createdAt: r.created_at,
          updatedAt: r.updated_at
        };
      });
    } catch (err) {
      console.error('[Inventory DB] MySQL read failed:', err.message);
    }
  }
  return [];
}

/**
 * Async Inventory Item Saver (Pure MySQL)
 */
async function saveInventoryItem(item) {
  if (isMySQLActive()) {
    try {
      await query(`
        INSERT INTO \`inventory\` (
          \`id\`, \`sku\`, \`name\`, \`category\`, \`stock_quantity\`, \`min_threshold\`, 
          \`unit\`, \`cost_price\`, \`selling_price\`, \`location\`, \`supplier\`, 
          \`last_restocked\`, \`available_serials\`, \`assignments\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          \`sku\` = VALUES(\`sku\`),
          \`name\` = VALUES(\`name\`),
          \`category\` = VALUES(\`category\`),
          \`stock_quantity\` = VALUES(\`stock_quantity\`),
          \`min_threshold\` = VALUES(\`min_threshold\`),
          \`unit\` = VALUES(\`unit\`),
          \`cost_price\` = VALUES(\`cost_price\`),
          \`selling_price\` = VALUES(\`selling_price\`),
          \`location\` = VALUES(\`location\`),
          \`supplier\` = VALUES(\`supplier\`),
          \`last_restocked\` = VALUES(\`last_restocked\`),
          \`available_serials\` = VALUES(\`available_serials\`),
          \`assignments\` = VALUES(\`assignments\`);
      `, [
        item.id,
        item.sku,
        item.name,
        item.category,
        Number(item.stockQuantity) || 0,
        Number(item.minThreshold) || 5,
        item.unit || 'Units',
        Number(item.costPrice) || 0,
        Number(item.sellingPrice) || 0,
        item.location || 'Warehouse Bay 1',
        item.supplier || 'Shuddham Manufacturing',
        item.lastRestocked || new Date().toISOString().split('T')[0],
        JSON.stringify(item.availableSerials || []),
        JSON.stringify(item.assignments || [])
      ]);
    } catch (err) {
      console.error('[Inventory DB] MySQL item save error:', err.message);
    }
  }
}

async function saveAllInventory(items) {
  if (isMySQLActive()) {
    for (const item of items) {
      await saveInventoryItem(item);
    }
  }
}

async function deleteInventoryFromDb(id) {
  if (isMySQLActive()) {
    try {
      await query('DELETE FROM `inventory` WHERE `id` = ?', [id]);
    } catch (err) {
      console.error('[Inventory DB] MySQL item delete error:', err.message);
    }
  }
}

/**
 * Compute stock status helper
 */
const getStockStatus = (quantity, minThreshold) => {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= minThreshold) return 'Low Stock';
  return 'In Stock';
};

/**
 * Physical Device ID regex and validation
 */
export const DEVICE_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9-_]*[A-Za-z0-9]$/;

export function isValidDeviceId(id) {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return false;
  return DEVICE_ID_REGEX.test(trimmed);
}

/**
 * Validate and process a batch of physical Device IDs.
 */
function processDeviceSerials(inputSerials, items, currentItemId = null) {
  let list = [];
  if (Array.isArray(inputSerials)) {
    list = inputSerials;
  } else if (typeof inputSerials === 'string') {
    list = inputSerials.split(/[,\n\r\t]+/).map(s => s.trim()).filter(Boolean);
  }

  const existingMap = new Map();
  for (const item of items) {
    if (!currentItemId || item.id !== currentItemId) {
      if (Array.isArray(item.availableSerials)) {
        for (const s of item.availableSerials) {
          if (s && typeof s === 'string' && s.trim()) {
            existingMap.set(s.trim().toUpperCase(), {
              serial: s.trim(),
              itemName: item.name,
              status: `Already in warehouse (${item.name})`
            });
          }
        }
      }
    }
    if (Array.isArray(item.assignments)) {
      for (const a of item.assignments) {
        if (a.serialNumber && typeof a.serialNumber === 'string' && a.serialNumber.trim()) {
          existingMap.set(a.serialNumber.trim().toUpperCase(), {
            serial: a.serialNumber.trim(),
            itemName: item.name,
            status: `Already assigned to ${a.adminName || 'Admin'}`
          });
        }
      }
    }
  }

  const addedSerials = [];
  const skippedSerials = [];
  const batchSeen = new Set();

  for (const raw of list) {
    const serial = String(raw).trim();
    if (!serial) continue;

    if (!isValidDeviceId(serial)) {
      skippedSerials.push({
        serial,
        reason: 'Invalid ID format (min 2 chars, letters, numbers & hyphens only, no +, @, /)'
      });
      continue;
    }

    const upper = serial.toUpperCase();

    if (batchSeen.has(upper)) {
      skippedSerials.push({
        serial,
        reason: 'Duplicate in input batch'
      });
      continue;
    }
    batchSeen.add(upper);

    if (existingMap.has(upper)) {
      const existingInfo = existingMap.get(upper);
      skippedSerials.push({
        serial,
        reason: existingInfo.status
      });
      continue;
    }

    addedSerials.push(serial);
    existingMap.set(upper, {
      serial,
      itemName: 'Current Batch',
      status: 'Current Batch'
    });
  }

  return { addedSerials, skippedSerials };
}

/**
 * Get all inventory items with filtering & search
 */
export const getInventory = async (req, res) => {
  try {
    const { category, status, search, adminId, adminEmail } = req.query;
    let items = await loadInventory();
    let result = [...items];

    if (adminId || adminEmail) {
      const targetId = adminId ? String(adminId).trim() : null;
      const targetEmail = adminEmail ? String(adminEmail).trim().toLowerCase() : null;

      result = result.filter(item => {
        const userAssignments = (item.assignments || []).filter(a => {
          const matchId = targetId && a.adminId && String(a.adminId).trim() === targetId;
          const matchEmail = targetEmail && a.adminEmail && String(a.adminEmail).trim().toLowerCase() === targetEmail;
          return matchId || matchEmail;
        });
        return userAssignments.length > 0;
      }).map(item => {
        const userAssignments = (item.assignments || []).filter(a => {
          const matchId = targetId && a.adminId && String(a.adminId).trim() === targetId;
          const matchEmail = targetEmail && a.adminEmail && String(a.adminEmail).trim().toLowerCase() === targetEmail;
          return matchId || matchEmail;
        });
        const assignedQuantity = userAssignments.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
        return {
          ...item,
          stockQuantity: assignedQuantity,
          assignedQuantity,
          myAssignments: userAssignments,
          isAssignedView: true,
          status: assignedQuantity <= 0 ? 'Out of Stock' : 'Assigned'
        };
      });
    }

    if (category && category !== 'All') {
      result = result.filter(item => item.category.toLowerCase() === category.toLowerCase());
    }

    if (status && status !== 'All') {
      result = result.filter(item => {
        const itemStatus = getStockStatus(item.stockQuantity, item.minThreshold);
        return itemStatus.toLowerCase() === status.toLowerCase();
      });
    }

    if (search) {
      const q = search.toLowerCase().trim();
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.supplier && item.supplier.toLowerCase().includes(q))
      );
    }

    const enriched = result.map(item => ({
      ...item,
      status: item.status || getStockStatus(item.stockQuantity, item.minThreshold)
    }));

    res.json({
      success: true,
      count: enriched.length,
      total: items.length,
      data: enriched
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error loading inventory' });
  }
};

/**
 * Get high-level inventory metrics & stats
 */
export const getInventoryStats = async (req, res) => {
  try {
    const { adminId, adminEmail } = req.query;
    const items = await loadInventory();

    let targetItems = items;
    if (adminId || adminEmail) {
      const targetId = adminId ? String(adminId).trim() : null;
      const targetEmail = adminEmail ? String(adminEmail).trim().toLowerCase() : null;

      targetItems = items.filter(item => {
        const userAssignments = (item.assignments || []).filter(a => {
          const matchId = targetId && a.adminId && String(a.adminId).trim() === targetId;
          const matchEmail = targetEmail && a.adminEmail && String(a.adminEmail).trim().toLowerCase() === targetEmail;
          return matchId || matchEmail;
        });
        return userAssignments.length > 0;
      }).map(item => {
        const userAssignments = (item.assignments || []).filter(a => {
          const matchId = targetId && a.adminId && String(a.adminId).trim() === targetId;
          const matchEmail = targetEmail && a.adminEmail && String(a.adminEmail).trim().toLowerCase() === targetEmail;
          return matchId || matchEmail;
        });
        const assignedQuantity = userAssignments.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
        return {
          ...item,
          stockQuantity: assignedQuantity,
          assignedQuantity
        };
      });
    }

    const totalItems = targetItems.length;
    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inStockCount = 0;
    let totalUnits = 0;

    const categoriesCount = {};

    targetItems.forEach(item => {
      const qty = Number(item.stockQuantity) || 0;
      const price = Number(item.sellingPrice) || 0;
      totalUnits += qty;
      totalValuation += qty * price;

      const status = getStockStatus(qty, item.minThreshold);
      if (status === 'Out of Stock') outOfStockCount++;
      else if (status === 'Low Stock') lowStockCount++;
      else inStockCount++;

      categoriesCount[item.category] = (categoriesCount[item.category] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalItems,
        totalUnits,
        totalValuation,
        lowStockCount,
        outOfStockCount,
        inStockCount,
        categories: categoriesCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error computing stats' });
  }
};

/**
 * Get single inventory item by ID
 */
export const getInventoryItemById = async (req, res) => {
  try {
    const items = await loadInventory();
    const item = items.find(i => i.id === req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    res.json({
      success: true,
      data: {
        ...item,
        status: getStockStatus(item.stockQuantity, item.minThreshold)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Create a new inventory item
 */
export const createInventoryItem = async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      stockQuantity = 0,
      minThreshold = 5,
      unit = 'Units',
      costPrice = 0,
      sellingPrice = 0,
      location,
      supplier,
      deviceIds
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Item name is required' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }

    const items = await loadInventory();
    const generatedSku = sku && sku.trim() 
      ? sku.trim().toUpperCase() 
      : `SHU-RO-${Date.now().toString().slice(-4)}`;

    const existing = items.find(i => i.sku.toLowerCase() === generatedSku.toLowerCase());
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `An inventory item with SKU '${generatedSku}' already exists.`
      });
    }

    let addedSerials = [];
    let skippedSerials = [];

    const hasDeviceIdsInput = deviceIds && (Array.isArray(deviceIds) ? deviceIds.length > 0 : String(deviceIds).trim().length > 0);
    if (!hasDeviceIdsInput) {
      return res.status(400).json({
        success: false,
        message: 'Physical Device IDs / Barcodes are compulsory! Please enter or scan at least one valid Device ID.'
      });
    }

    const result = processDeviceSerials(deviceIds, items);
    addedSerials = result.addedSerials;
    skippedSerials = result.skippedSerials;

    if (addedSerials.length === 0) {
      const skippedListStr = skippedSerials.map(s => `${s.serial}${s.reason ? ` (${s.reason})` : ''}`).join(', ');
      return res.status(400).json({
        success: false,
        message: `Cannot create device: No valid Device IDs were added! [${skippedListStr}]`
      });
    }

    const finalStockQty = addedSerials.length;

    const newItem = {
      id: `inv-${Date.now()}`,
      sku: generatedSku,
      name: name.trim(),
      category: category.trim(),
      stockQuantity: finalStockQty,
      minThreshold: Number(minThreshold) >= 0 ? Number(minThreshold) : 5,
      unit: unit || 'Units',
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      location: location?.trim() || 'Warehouse Bay 1',
      supplier: supplier?.trim() || 'Shuddham Manufacturing',
      lastRestocked: new Date().toISOString().split('T')[0],
      availableSerials: addedSerials,
      assignments: []
    };

    items.unshift(newItem);
    await saveInventoryItem(newItem);

    let message = `Inventory item '${newItem.name}' created with ${newItem.stockQuantity} ${newItem.unit} in stock.`;
    if (skippedSerials.length > 0) {
      const skippedListStr = skippedSerials.map(s => s.serial).join(', ');
      message = `Added ${addedSerials.length} new device(s). Skipped ${skippedSerials.length} duplicate ID(s): [${skippedListStr}].`;
    }

    res.status(201).json({
      success: true,
      message,
      addedCount: addedSerials.length,
      skippedCount: skippedSerials.length,
      addedSerials,
      skippedSerials,
      data: {
        ...newItem,
        status: getStockStatus(newItem.stockQuantity, newItem.minThreshold)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error creating item' });
  }
};

/**
 * Bulk create inventory items from CSV / JSON array
 */
export const bulkCreateInventoryItems = async (req, res) => {
  try {
    const { items: rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided for bulk upload.' });
    }

    let currentItems = await loadInventory();
    let currentCategories = await loadCategories();

    const results = [];
    const autoCreatedCategories = [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const rowNum = rowIndex + 1;

      const {
        name,
        sku,
        category,
        deviceIds,
        sellingPrice = 0,
        costPrice = 0,
        minThreshold = 5,
        unit = 'Units',
        location,
        supplier
      } = row;

      if (!name || !String(name).trim()) {
        results.push({ rowNum, name: name || '', success: false, error: 'Device name is required' });
        continue;
      }
      if (!category || !String(category).trim()) {
        results.push({ rowNum, name, success: false, error: 'Category is required' });
        continue;
      }
      const hasDeviceIds = deviceIds && (Array.isArray(deviceIds) ? deviceIds.length > 0 : String(deviceIds).trim().length > 0);
      if (!hasDeviceIds) {
        results.push({ rowNum, name, success: false, error: 'At least one Device ID is required' });
        continue;
      }

      const categoryTrimmed = String(category).trim();
      const categoryExists = currentCategories.some(
        c => c.name.toLowerCase() === categoryTrimmed.toLowerCase()
      );
      let categoryAutoCreated = false;
      if (!categoryExists) {
        const newCat = {
          id: `cat-bulk-${Date.now()}-${rowNum}`,
          name: categoryTrimmed,
          description: `Auto-created during bulk upload`,
          icon: 'Box',
          createdAt: new Date().toISOString().split('T')[0]
        };
        currentCategories.push(newCat);
        autoCreatedCategories.push(newCat.name);
        await saveCategory(newCat);
        categoryAutoCreated = true;
      }

      const generatedSku = sku && String(sku).trim()
        ? String(sku).trim().toUpperCase()
        : `SHU-RO-${Date.now().toString().slice(-6)}-${rowNum}`;

      const skuExists = currentItems.find(i => i.sku.toLowerCase() === generatedSku.toLowerCase());
      if (skuExists) {
        results.push({ rowNum, name, success: false, error: `SKU '${generatedSku}' already exists`, categoryAutoCreated });
        continue;
      }

      const { addedSerials, skippedSerials } = processDeviceSerials(deviceIds, currentItems);

      if (addedSerials.length === 0) {
        const skippedStr = skippedSerials.map(s => `${s.serial}${s.reason ? ` (${s.reason})` : ''}`).join(', ');
        results.push({ rowNum, name, success: false, error: `No valid Device IDs: [${skippedStr}]` });
        continue;
      }

      const newItem = {
        id: `inv-${Date.now()}-${rowNum}`,
        sku: generatedSku,
        name: String(name).trim(),
        category: String(category).trim(),
        stockQuantity: addedSerials.length,
        minThreshold: Number(minThreshold) >= 0 ? Number(minThreshold) : 5,
        unit: unit || 'Units',
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        location: location?.trim() || 'Warehouse Bay 1',
        supplier: supplier?.trim() || 'Shuddham Manufacturing',
        lastRestocked: new Date().toISOString().split('T')[0],
        availableSerials: addedSerials,
        assignments: []
      };

      currentItems.unshift(newItem);
      await saveInventoryItem(newItem);

      results.push({
        rowNum,
        name: newItem.name,
        success: true,
        addedCount: addedSerials.length,
        skippedCount: skippedSerials.length,
        skippedSerials,
        categoryAutoCreated,
        data: { ...newItem, status: getStockStatus(newItem.stockQuantity, newItem.minThreshold) }
      });
    }



    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const totalDevicesAdded = results.filter(r => r.success).reduce((sum, r) => sum + (r.addedCount || 0), 0);
    const totalDevicesSkipped = results.filter(r => r.success).reduce((sum, r) => sum + (r.skippedCount || 0), 0);

    let message = `Bulk upload complete: ${totalDevicesAdded} physical device${totalDevicesAdded !== 1 ? 's' : ''} added across ${successCount} model${successCount !== 1 ? 's' : ''}.`;
    if (failCount > 0) message += ` ${failCount} row${failCount !== 1 ? 's' : ''} failed.`;
    if (totalDevicesSkipped > 0) message += ` ${totalDevicesSkipped} duplicate ID${totalDevicesSkipped !== 1 ? 's' : ''} skipped.`;
    if (autoCreatedCategories.length > 0) {
      message += ` Auto-created ${autoCreatedCategories.length} new categor${autoCreatedCategories.length !== 1 ? 'ies' : 'y'}: [${autoCreatedCategories.join(', ')}].`;
    }

    res.status(200).json({
      success: true,
      message,
      successCount,
      failCount,
      totalDevicesAdded,
      totalDevicesSkipped,
      autoCreatedCategories,
      results,
      createdItems: results.filter(r => r.success).map(r => r.data)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error during bulk upload' });
  }
};

/**
 * Update an existing inventory item
 */
export const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const items = await loadInventory();
    const index = items.findIndex(i => i.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const current = items[index];
    const {
      name,
      sku,
      category,
      stockQuantity,
      minThreshold,
      unit,
      costPrice,
      sellingPrice,
      location,
      supplier
    } = req.body;

    if (sku && sku.trim().toLowerCase() !== current.sku.toLowerCase()) {
      const duplicate = items.find(i => i.id !== id && i.sku.toLowerCase() === sku.trim().toLowerCase());
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `An inventory item with SKU '${sku}' already exists.`
        });
      }
    }

    let newAvailableSerials = Array.isArray(current.availableSerials) ? [...current.availableSerials] : [];
    let newStockQuantity = current.stockQuantity;

    const rawDeviceIds = req.body.deviceIds !== undefined ? req.body.deviceIds : req.body.availableSerials;
    if (rawDeviceIds !== undefined) {
      const isBlank = Array.isArray(rawDeviceIds) ? rawDeviceIds.length === 0 : !String(rawDeviceIds).trim();
      if (isBlank) {
        newAvailableSerials = [];
        newStockQuantity = 0;
      } else {
        const result = processDeviceSerials(rawDeviceIds, items, current.id);
        if (result.addedSerials.length === 0 && result.skippedSerials.length > 0) {
          const skippedListStr = result.skippedSerials.map(s => `${s.serial}${s.reason ? ` (${s.reason})` : ''}`).join(', ');
          return res.status(400).json({
            success: false,
            message: `Cannot update device IDs: No valid Device IDs! [${skippedListStr}]`
          });
        }
        newAvailableSerials = result.addedSerials;
        newStockQuantity = newAvailableSerials.length;
      }
    } else if (stockQuantity !== undefined) {
      newStockQuantity = Math.max(0, Number(stockQuantity));
    }

    const updated = {
      ...current,
      name: name !== undefined ? name.trim() : current.name,
      sku: sku !== undefined ? sku.trim().toUpperCase() : current.sku,
      category: category !== undefined ? category.trim() : current.category,
      stockQuantity: newStockQuantity,
      availableSerials: newAvailableSerials,
      minThreshold: minThreshold !== undefined ? Math.max(0, Number(minThreshold)) : current.minThreshold,
      unit: unit !== undefined ? unit : current.unit,
      costPrice: costPrice !== undefined ? Number(costPrice) : current.costPrice,
      sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : current.sellingPrice,
      location: location !== undefined ? location.trim() : current.location,
      supplier: supplier !== undefined ? supplier.trim() : current.supplier,
      updatedAt: new Date().toISOString(),
      assignments: Array.isArray(current.assignments) ? current.assignments : []
    };

    items[index] = updated;
    await saveInventoryItem(updated);

    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: {
        ...updated,
        status: getStockStatus(updated.stockQuantity, updated.minThreshold)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error updating item' });
  }
};

/**
 * Assign Device to an Admin (Dispatch / Allocate from Warehouse)
 */
export const assignDeviceToAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      adminId,
      adminEmail,
      adminName,
      quantity,
      serialNumber,
      serialNumbers,
      customerName,
      customerPhone,
      installationAddress,
      note
    } = req.body;

    const items = await loadInventory();
    const item = items.find(i => i.id === id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'RO device not found in inventory' });
    }

    if (!Array.isArray(item.assignments)) item.assignments = [];
    if (!Array.isArray(item.availableSerials)) item.availableSerials = [];

    let targetSerials = [];
    if (Array.isArray(serialNumbers) && serialNumbers.length > 0) {
      targetSerials = serialNumbers.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof serialNumbers === 'string' && serialNumbers.trim()) {
      targetSerials = serialNumbers.split(/[,\n\r\t]+/).map(s => s.trim()).filter(Boolean);
    } else if (serialNumber) {
      if (Array.isArray(serialNumber)) {
        targetSerials = serialNumber.map(s => String(s).trim()).filter(Boolean);
      } else {
        targetSerials = String(serialNumber).split(/[,\n\r\t]+/).map(s => s.trim()).filter(Boolean);
      }
    }

    if (targetSerials.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Physical Device Serial / ID is compulsory! Please select or enter at least one Device ID.'
      });
    }

    const assignCount = targetSerials.length;

    if (item.stockQuantity < assignCount) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign ${assignCount} devices. Only ${item.stockQuantity} ${item.unit} available in warehouse.`
      });
    }

    if (item.availableSerials.length > 0) {
      const notFoundSerials = targetSerials.filter(s => 
        !item.availableSerials.some(avail => avail.toUpperCase() === s.toUpperCase())
      );
      if (notFoundSerials.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Device ID(s) [${notFoundSerials.join(', ')}] are not available in warehouse stock!`
        });
      }
    }

    for (const s of targetSerials) {
      const sIdx = item.availableSerials.findIndex(avail => avail.toUpperCase() === s.toUpperCase());
      if (sIdx !== -1) {
        item.availableSerials.splice(sIdx, 1);
      }
    }

    item.stockQuantity = Math.max(0, item.stockQuantity - assignCount);

    const createdAssignments = [];
    const timestamp = new Date().toISOString();
    for (let idx = 0; idx < targetSerials.length; idx++) {
      const s = targetSerials[idx];
      const newAssignment = {
        id: `asgn-${Date.now()}-${idx}-${Math.floor(100 + Math.random() * 900)}`,
        adminId: adminId || '',
        adminEmail: adminEmail || '',
        adminName: adminName || 'Admin',
        quantity: 1,
        serialNumber: s,
        customerName: customerName?.trim() || '',
        customerPhone: customerPhone?.trim() || '',
        installationAddress: installationAddress?.trim() || '',
        note: note?.trim() || 'Assigned to admin for field operations',
        assignedDate: timestamp,
        status: 'Assigned'
      };
      item.assignments.push(newAssignment);
      createdAssignments.push(newAssignment);
    }

    await saveInventoryItem(item);

    return res.json({
      success: true,
      message: `Allocated ${assignCount} ${item.unit} (${targetSerials.join(', ')}) to ${adminName || adminEmail || 'Admin'} successfully!`,
      data: {
        ...item,
        status: getStockStatus(item.stockQuantity, item.minThreshold)
      },
      assignments: createdAssignments
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error assigning device' });
  }
};

/**
 * Unassign Device / Return to Warehouse Stock
 */
export const unassignDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignmentId } = req.body;

    const items = await loadInventory();
    const item = items.find(i => i.id === id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'RO device not found' });
    }

    if (!Array.isArray(item.assignments)) item.assignments = [];
    if (!Array.isArray(item.availableSerials)) item.availableSerials = [];

    const asgnIdx = item.assignments.findIndex(a => a.id === assignmentId);
    if (asgnIdx === -1) {
      return res.status(404).json({ success: false, message: 'Assignment record not found' });
    }

    const removed = item.assignments.splice(asgnIdx, 1)[0];
    item.stockQuantity += (Number(removed.quantity) || 1);

    if (removed.serialNumber && !item.availableSerials.some(s => s.toUpperCase() === removed.serialNumber.toUpperCase())) {
      item.availableSerials.push(removed.serialNumber);
    }

    await saveInventoryItem(item);

    return res.json({
      success: true,
      message: `Returned ${removed.quantity} unit(s) of "${item.name}" back to warehouse stock.`,
      data: {
        ...item,
        status: getStockStatus(item.stockQuantity, item.minThreshold)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error unassigning device' });
  }
};

/**
 * Quick stock adjustment (restock, consumption, manual delta)
 */
export const adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type = 'add', reason, reference, deviceIds } = req.body;

    const items = await loadInventory();
    const item = items.find(i => i.id === id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (!Array.isArray(item.availableSerials)) item.availableSerials = [];

    let qtyChange = Number(amount);
    let addedSerials = [];
    let skippedSerials = [];

    const hasDeviceIds = deviceIds && (Array.isArray(deviceIds) ? deviceIds.length > 0 : String(deviceIds).trim().length > 0);

    if (type === 'add') {
      if (!hasDeviceIds) {
        return res.status(400).json({
          success: false,
          message: 'Physical Device IDs / Barcodes are compulsory for restocking! Please enter or scan at least one valid Device ID.'
        });
      }

      const result = processDeviceSerials(deviceIds, items, item.id);
      addedSerials = result.addedSerials;
      skippedSerials = result.skippedSerials;

      if (addedSerials.length === 0) {
        const skippedListStr = skippedSerials.map(s => `${s.serial}${s.reason ? ` (${s.reason})` : ''}`).join(', ');
        return res.status(400).json({
          success: false,
          message: `Cannot restock: No valid Device IDs were added! [${skippedListStr}]`
        });
      }

      qtyChange = addedSerials.length;
      item.availableSerials.push(...addedSerials);
    } else {
      if (isNaN(qtyChange) || qtyChange <= 0) {
        return res.status(400).json({ success: false, message: 'Valid adjustment amount required' });
      }
    }

    let newQuantity = item.stockQuantity;
    if (type === 'add') {
      newQuantity += qtyChange;
      item.lastRestocked = new Date().toISOString().split('T')[0];
    } else if (type === 'deduct') {
      if (newQuantity < qtyChange) {
        return res.status(400).json({
          success: false,
          message: `Cannot deduct ${qtyChange} units. Only ${newQuantity} units currently in stock.`
        });
      }
      newQuantity -= qtyChange;
    } else if (type === 'set') {
      newQuantity = qtyChange;
    }

    item.stockQuantity = newQuantity;
    await saveInventoryItem(item);

    let message = `Stock ${type === 'add' ? 'replenished' : 'deducted'} successfully (${type === 'add' ? '+' : '-'}${qtyChange} ${item.unit})`;
    if (type === 'add' && skippedSerials.length > 0) {
      const skippedListStr = skippedSerials.map(s => s.serial).join(', ');
      message = `Restocked +${addedSerials.length} unit(s). Skipped ${skippedSerials.length} duplicate ID(s): [${skippedListStr}].`;
    }

    res.json({
      success: true,
      message,
      addedCount: addedSerials.length,
      skippedCount: skippedSerials.length,
      addedSerials,
      skippedSerials,
      data: {
        ...item,
        status: getStockStatus(item.stockQuantity, item.minThreshold),
        lastAdjustment: {
          type,
          amount: qtyChange,
          reason: reason || 'Routine inventory adjustment',
          reference: reference || null,
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error adjusting stock' });
  }
};

/**
 * Delete an inventory item
 */
export const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const items = await loadInventory();
    const index = items.findIndex(i => i.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const removed = items.splice(index, 1)[0];
    await deleteInventoryFromDb(id);

    res.json({
      success: true,
      message: `Inventory item '${removed.name}' (${removed.sku}) removed successfully.`,
      data: removed
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error deleting inventory item' });
  }
};

/**
 * ============================================================================
 * DEVICE CATEGORIES CONTROLLERS (CRUD)
 * ============================================================================
 */

export const getCategories = async (req, res) => {
  try {
    const currentCats = await loadCategories();
    const currentInv = await loadInventory();

    const enriched = currentCats.map(cat => ({
      ...cat,
      deviceCount: currentInv.filter(i => i.category && i.category.toLowerCase() === cat.name.toLowerCase()).length
    }));

    res.json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error loading categories' });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const currentCats = await loadCategories();
    const trimmed = name.trim();
    const existing = currentCats.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, message: `Category '${trimmed}' already exists.` });
    }

    const newCategory = {
      id: `cat-${Date.now()}`,
      name: trimmed,
      description: description ? description.trim() : 'Water purification device series',
      icon: icon || 'Box',
      createdAt: new Date().toISOString().split('T')[0]
    };

    currentCats.push(newCategory);
    await saveCategory(newCategory);

    res.status(201).json({
      success: true,
      message: `Category '${newCategory.name}' created successfully`,
      data: { ...newCategory, deviceCount: 0 }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error creating category' });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon } = req.body;

    const currentCats = await loadCategories();
    const index = currentCats.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const current = currentCats[index];
    const trimmed = name ? name.trim() : current.name;

    if (name && trimmed.toLowerCase() !== current.name.toLowerCase()) {
      const duplicate = currentCats.find(c => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase());
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Category '${trimmed}' already exists.` });
      }
    }

    const oldName = current.name;
    const updated = {
      ...current,
      name: trimmed,
      description: description !== undefined ? description.trim() : current.description,
      icon: icon || current.icon,
      updatedAt: new Date().toISOString()
    };

    currentCats[index] = updated;
    await saveCategory(updated);

    const currentInv = await loadInventory();
    let affectedItemsCount = 0;
    if (oldName.toLowerCase() !== trimmed.toLowerCase()) {
      for (const item of currentInv) {
        if (item.category.toLowerCase() === oldName.toLowerCase()) {
          item.category = trimmed;
          affectedItemsCount++;
          await saveInventoryItem(item);
        }
      }
    }

    const deviceCount = currentInv.filter(i => i.category && i.category.toLowerCase() === trimmed.toLowerCase()).length;

    res.json({
      success: true,
      message: `Category '${updated.name}' updated successfully${affectedItemsCount > 0 ? ` (${affectedItemsCount} linked devices updated)` : ''}`,
      data: { ...updated, deviceCount }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error updating category' });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const currentCats = await loadCategories();
    const index = currentCats.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const target = currentCats[index];
    const currentInv = await loadInventory();
    const linkedDevices = currentInv.filter(i => i.category && i.category.toLowerCase() === target.name.toLowerCase());

    if (linkedDevices.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category '${target.name}'. There are ${linkedDevices.length} RO device(s) currently linked to it. Please reassign or delete those devices first.`
      });
    }

    const removed = currentCats.splice(index, 1)[0];
    await deleteCategoryFromDb(id);

    res.json({
      success: true,
      message: `Category '${removed.name}' removed successfully`,
      data: removed
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error deleting category' });
  }
};
