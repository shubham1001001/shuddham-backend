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
          lastRestocked: r.last_restocked ? (r.last_restocked instanceof Date ? r.last_restocked.toISOString().split('T')[0] : String(r.last_restocked).split('T')[0]) : new Date().toISOString().split('T')[0],
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
    let generatedSku = sku && sku.trim() ? sku.trim().toUpperCase() : null;
    if (!generatedSku) {
      let candidate = `SHU-RO-${Date.now()}`;
      let counter = 1;
      while (items.some(i => i.sku && i.sku.toLowerCase() === candidate.toLowerCase())) {
        candidate = `SHU-RO-${Date.now()}-${counter++}`;
      }
      generatedSku = candidate;
    } else {
      const existing = items.find(i => i.sku && i.sku.toLowerCase() === generatedSku.toLowerCase());
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `An inventory item with this identifier already exists.`
        });
      }
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

      let generatedSku = sku && String(sku).trim() ? String(sku).trim().toUpperCase() : null;
      if (!generatedSku) {
        let candidate = `SHU-RO-${Date.now()}-${rowNum}`;
        let counter = 1;
        while (currentItems.some(i => i.sku && i.sku.toLowerCase() === candidate.toLowerCase())) {
          candidate = `SHU-RO-${Date.now()}-${rowNum}-${counter++}`;
        }
        generatedSku = candidate;
      } else {
        const skuExists = currentItems.find(i => i.sku && i.sku.toLowerCase() === generatedSku.toLowerCase());
        if (skuExists) {
          results.push({ rowNum, name, success: false, error: 'Device code already exists', categoryAutoCreated });
          continue;
        }
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

    if (sku && current.sku && sku.trim().toLowerCase() !== current.sku.toLowerCase()) {
      const duplicate = items.find(i => i.id !== id && i.sku && i.sku.toLowerCase() === sku.trim().toLowerCase());
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `An inventory item with this identifier already exists.`
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
      inventoryId,
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
    const lookupId = id || inventoryId || req.body.id;
    let item = lookupId ? items.find(i => i.id === lookupId) : null;
    if (!item && (serialNumber || serialNumbers)) {
      const firstSerial = Array.isArray(serialNumbers) && serialNumbers.length > 0
        ? serialNumbers[0]
        : (Array.isArray(serialNumber) ? serialNumber[0] : String(serialNumber || '').split(/[,\n\r\t]+/)[0]?.trim());
      if (firstSerial) {
        item = items.find(i => Array.isArray(i.availableSerials) && i.availableSerials.some(s => s.toUpperCase() === firstSerial.toUpperCase()));
      }
    }
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
    console.error('[AssignDeviceToAdmin Error]', err);
    res.status(500).json({ success: false, message: 'Server error assigning device', error: err.message });
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
    console.error('[UnassignDevice Error]', err);
    res.status(500).json({ success: false, message: 'Server error unassigning device', error: err.message });
  }
};

// Helper to normalize phone numbers strictly to 10 digits
const normalizePhone = (phoneStr) => {
  if (!phoneStr) return '';
  const digits = phoneStr.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.substring(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.substring(1);
  return digits.length > 10 ? digits.slice(-10) : digits;
};

// Helper to clean MAC address / device IDs for consistent matching
const cleanMac = (str) => (str || '').toString().toLowerCase().replace(/[^a-f0-9]/g, '');

/**
 * Assign Device to Customer (From Admin's custody or directly from Warehouse)
 * Lifecycle: In Stock -> Allocated to Admin -> Assigned/Installed at Customer
 */
export const assignDeviceToCustomer = async (req, res) => {
  try {
    const {
      serialNumber,
      serialNumbers,
      assignmentId,
      inventoryId,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      installationAddress,
      warrantyMonths = 12,
      technicianId,
      technicianName,
      adminId,
      adminName,
      note
    } = req.body;

    let targetSerials = [];
    if (Array.isArray(serialNumbers) && serialNumbers.length > 0) {
      targetSerials = serialNumbers.map(s => String(s).trim()).filter(Boolean);
    } else if (serialNumber) {
      if (Array.isArray(serialNumber)) {
        targetSerials = serialNumber.map(s => String(s).trim()).filter(Boolean);
      } else {
        targetSerials = String(serialNumber).split(/[,\n\r\t]+/).map(s => s.trim()).filter(Boolean);
      }
    }

    if (targetSerials.length === 0 && !assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Serial Number / Device ID or Assignment ID is required to assign to customer.'
      });
    }

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer Name is required.'
      });
    }

    const cleanPhone = normalizePhone(customerPhone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'A valid 10-digit customer phone number is required.'
      });
    }

    // Auto-resolve or create customer user record in database
    let resolvedCustomerId = customerId || '';
    if (isMySQLActive()) {
      try {
        const userRows = await query('SELECT id, full_name, email, phone FROM users WHERE phone LIKE ? OR phone = ? LIMIT 1', [`%${cleanPhone}%`, cleanPhone]);
        if (userRows && userRows.length > 0) {
          resolvedCustomerId = userRows[0].id;
        } else {
          resolvedCustomerId = `usr-cust-${Date.now()}`;
          const dummyEmail = customerEmail && customerEmail.trim() ? customerEmail.trim() : `${cleanPhone}@shuddham.in`;
          await query(`
            INSERT INTO users (id, full_name, email, phone, role, password)
            VALUES (?, ?, ?, ?, 'Customer', 'shuddham123')
            ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)
          `, [resolvedCustomerId, customerName.trim(), dummyEmail, cleanPhone]);
        }
      } catch (userErr) {
        console.error('[AssignCustomer] User lookup/create notice:', userErr.message);
      }
    }
    if (!resolvedCustomerId) {
      resolvedCustomerId = `usr-${cleanPhone}`;
    }

    const items = await loadInventory();
    const now = new Date();
    const warrantyEnd = new Date(now);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + (Number(warrantyMonths) || 12));

    const updatedAssignments = [];
    let affectedItem = null;

    // Case 1: Specific assignmentId provided
    if (assignmentId) {
      for (const item of items) {
        if (Array.isArray(item.assignments)) {
          const asgn = item.assignments.find(a => a.id === assignmentId);
          if (asgn) {
            asgn.customerId = resolvedCustomerId;
            asgn.customerName = customerName.trim();
            asgn.customerPhone = cleanPhone;
            asgn.customerEmail = customerEmail?.trim() || asgn.customerEmail || '';
            asgn.installationAddress = installationAddress?.trim() || asgn.installationAddress || '';
            asgn.installedAt = now.toISOString();
            asgn.warrantyUntil = warrantyEnd.toISOString();
            asgn.warrantyMonths = Number(warrantyMonths) || 12;
            asgn.status = 'Installed';
            if (technicianId) asgn.technicianId = technicianId;
            if (technicianName) asgn.technicianName = technicianName;
            if (note) asgn.note = note.trim();
            affectedItem = item;
            updatedAssignments.push(asgn);
            break;
          }
        }
      }
    } else {
      // Case 2: Provided serial numbers
      for (const serial of targetSerials) {
        let found = false;

        // A. Check if already in an admin's assignment list (promote to Installed)
        for (const item of items) {
          if (Array.isArray(item.assignments)) {
            const asgn = item.assignments.find(a => 
              a.serialNumber && a.serialNumber.toUpperCase() === serial.toUpperCase()
            );
            if (asgn) {
              asgn.customerId = resolvedCustomerId;
              asgn.customerName = customerName.trim();
              asgn.customerPhone = cleanPhone;
              asgn.customerEmail = customerEmail?.trim() || asgn.customerEmail || '';
              asgn.installationAddress = installationAddress?.trim() || asgn.installationAddress || '';
              asgn.installedAt = now.toISOString();
              asgn.warrantyUntil = warrantyEnd.toISOString();
              asgn.warrantyMonths = Number(warrantyMonths) || 12;
              asgn.status = 'Installed';
              if (adminId && !asgn.adminId) asgn.adminId = adminId;
              if (adminName && !asgn.adminName) asgn.adminName = adminName;
              if (technicianId) asgn.technicianId = technicianId;
              if (technicianName) asgn.technicianName = technicianName;
              if (note) asgn.note = note.trim();
              affectedItem = item;
              updatedAssignments.push(asgn);
              found = true;
              break;
            }
          }
        }

        // B. If not in assignments yet, check availableSerials in warehouse
        if (!found) {
          let targetItem = null;
          if (inventoryId) {
            targetItem = items.find(i => i.id === inventoryId);
          }
          if (!targetItem) {
            targetItem = items.find(i => 
              Array.isArray(i.availableSerials) && 
              i.availableSerials.some(s => s.toUpperCase() === serial.toUpperCase())
            );
          }

          if (targetItem) {
            if (!Array.isArray(targetItem.availableSerials)) targetItem.availableSerials = [];
            if (!Array.isArray(targetItem.assignments)) targetItem.assignments = [];

            const sIdx = targetItem.availableSerials.findIndex(s => s.toUpperCase() === serial.toUpperCase());
            if (sIdx !== -1) {
              targetItem.availableSerials.splice(sIdx, 1);
            }
            targetItem.stockQuantity = Math.max(0, targetItem.stockQuantity - 1);

            const newAsgn = {
              id: `asgn-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
              adminId: adminId || 'admin-hq',
              adminName: adminName || 'Central Operations',
              adminEmail: '',
              quantity: 1,
              serialNumber: serial,
              customerId: resolvedCustomerId,
              customerName: customerName.trim(),
              customerPhone: cleanPhone,
              customerEmail: customerEmail?.trim() || '',
              installationAddress: installationAddress?.trim() || '',
              assignedDate: now.toISOString(),
              installedAt: now.toISOString(),
              warrantyUntil: warrantyEnd.toISOString(),
              warrantyMonths: Number(warrantyMonths) || 12,
              status: 'Installed',
              technicianId: technicianId || '',
              technicianName: technicianName || '',
              note: note?.trim() || 'Direct customer installation'
            };

            targetItem.assignments.push(newAsgn);
            affectedItem = targetItem;
            updatedAssignments.push(newAsgn);
          }
        }
      }
    }

    if (updatedAssignments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching device or assignment found for the specified Serial / ID.'
      });
    }

    if (affectedItem) {
      await saveInventoryItem(affectedItem);
    }

    return res.status(200).json({
      success: true,
      message: `Device (${updatedAssignments.map(a => a.serialNumber).join(', ')}) successfully assigned to customer ${customerName} (+91 ${cleanPhone})!`,
      data: updatedAssignments.length === 1 ? updatedAssignments[0] : updatedAssignments
    });
  } catch (err) {
    console.error('[AssignCustomer Error]', err);
    return res.status(500).json({ success: false, message: 'Server error assigning device to customer', error: err.message });
  }
};

/**
 * Unassign Device from Customer (Returns back to Admin custody or Warehouse stock)
 */
export const unassignDeviceFromCustomer = async (req, res) => {
  try {
    const { serialNumber, assignmentId, returnToWarehouse = false } = req.body;

    if (!serialNumber && !assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Either serialNumber or assignmentId is required.'
      });
    }

    const items = await loadInventory();
    let targetItem = null;
    let targetAssignment = null;

    for (const item of items) {
      if (Array.isArray(item.assignments)) {
        const found = item.assignments.find(a => 
          (assignmentId && a.id === assignmentId) ||
          (serialNumber && a.serialNumber && a.serialNumber.toUpperCase() === serialNumber.trim().toUpperCase())
        );
        if (found) {
          targetItem = item;
          targetAssignment = found;
          break;
        }
      }
    }

    if (!targetAssignment || !targetItem) {
      return res.status(404).json({
        success: false,
        message: 'Device assignment record not found.'
      });
    }

    const prevCustomerName = targetAssignment.customerName || 'Customer';

    if (returnToWarehouse) {
      const asgnIdx = targetItem.assignments.findIndex(a => a.id === targetAssignment.id);
      if (asgnIdx !== -1) {
        targetItem.assignments.splice(asgnIdx, 1);
      }
      targetItem.stockQuantity += 1;
      if (targetAssignment.serialNumber && !targetItem.availableSerials.some(s => s.toUpperCase() === targetAssignment.serialNumber.toUpperCase())) {
        targetItem.availableSerials.push(targetAssignment.serialNumber);
      }
    } else {
      targetAssignment.customerId = null;
      targetAssignment.customerName = '';
      targetAssignment.customerPhone = '';
      targetAssignment.customerEmail = '';
      targetAssignment.installationAddress = '';
      targetAssignment.installedAt = null;
      targetAssignment.warrantyUntil = null;
      targetAssignment.status = 'Allocated';
      targetAssignment.note = `Unassigned from ${prevCustomerName} on ${new Date().toISOString().split('T')[0]}`;
    }

    await saveInventoryItem(targetItem);

    return res.status(200).json({
      success: true,
      message: `Device ${targetAssignment.serialNumber || ''} successfully unassigned from ${prevCustomerName}. ${returnToWarehouse ? 'Returned to Warehouse stock.' : 'Retained in Admin custody.'}`,
      data: targetAssignment
    });
  } catch (err) {
    console.error('[UnassignCustomer Error]', err);
    return res.status(500).json({ success: false, message: 'Server error unassigning device from customer', error: err.message });
  }
};

/**
 * Fetch all devices assigned to a specific customer
 * (Supports Bearer JWT token, or ?phone=..., or ?customerId=...)
 * Merges real-time sensor telemetry (TDS, Temp, Online/Offline, Mode, Fan).
 */
export const getCustomerDevices = async (req, res) => {
  try {
    let customerId = (req.query.customerId || req.query.userId || '').toString().trim();
    let phone = (req.query.phone || '').toString().trim();
    let email = (req.query.email || '').toString().trim().toLowerCase();

    // 1. Extract credentials from Bearer JWT token if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const parts = token.split('.');
      if (parts.length >= 2) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          if (!customerId && (payload.userId || payload.id)) {
            customerId = payload.userId || payload.id;
          }
          if (!phone && payload.phone) {
            phone = payload.phone;
          }
          if (!email && (payload.email || payload.userEmail)) {
            email = (payload.email || payload.userEmail).toString().trim().toLowerCase();
          }
        } catch (_) {}
      }
    }

    // 2. Cross-reference with MySQL users table if customerId is given but phone/email missing
    if (customerId && (!phone || !email) && isMySQLActive()) {
      try {
        const uRows = await query('SELECT phone, email FROM users WHERE id = ? LIMIT 1', [customerId]);
        if (uRows && uRows.length > 0) {
          if (!phone && uRows[0].phone) phone = uRows[0].phone;
          if (!email && uRows[0].email) email = uRows[0].email;
        }
      } catch (_) {}
    }

    // 3. Reverse lookup customerId from phone/email if missing
    if ((phone || email) && !customerId && isMySQLActive()) {
      try {
        let uRows = [];
        if (phone) {
          const cleanDigits = phone.replace(/\D/g, '').slice(-10);
          if (cleanDigits.length >= 10) {
            uRows = await query('SELECT id, phone, email FROM users WHERE phone LIKE ? LIMIT 1', [`%${cleanDigits}`]);
          }
        }
        if ((!uRows || uRows.length === 0) && email) {
          uRows = await query('SELECT id, phone, email FROM users WHERE LOWER(email) = ? LIMIT 1', [email.toLowerCase()]);
        }
        if (uRows && uRows.length > 0) {
          if (!customerId) customerId = uRows[0].id;
          if (!phone && uRows[0].phone) phone = uRows[0].phone;
          if (!email && uRows[0].email) email = uRows[0].email;
        }
      } catch (_) {}
    }

    const cleanPhone = normalizePhone(phone);
    const cleanPhone10 = cleanPhone.replace(/\D/g, '').slice(-10);

    if (!customerId && cleanPhone10.length < 10 && !email) {
      return res.status(400).json({
        success: false,
        message: 'Authentication token or customer phone / email / ID is required to fetch assigned devices.'
      });
    }

    let latestTelemetryList = [];
    if (isMySQLActive()) {
      try {
        latestTelemetryList = await query('SELECT * FROM device_latest_telemetry');
      } catch (e) {
        latestTelemetryList = [];
      }
    }

    const items = await loadInventory();
    const matchedDevices = [];

    for (const item of items) {
      if (Array.isArray(item.assignments)) {
        for (const a of item.assignments) {
          // Verify customer matching
          const aPhoneClean = normalizePhone(a.customerPhone || '');
          const aPhone10 = aPhoneClean.replace(/\D/g, '').slice(-10);

          const matchPhone = cleanPhone10.length >= 10 && aPhone10.length >= 10 && (aPhone10 === cleanPhone10);
          const matchId = customerId && a.customerId && String(a.customerId).trim() === String(customerId).trim();
          const matchEmail = email && a.customerEmail && a.customerEmail.trim().toLowerCase() === email.trim().toLowerCase();

          // Strictly match devices assigned to THIS specific customer only
          if (matchPhone || matchId || matchEmail) {
            const serialClean = cleanMac(a.serialNumber);
            const telem = latestTelemetryList.find(t => {
              const tDevClean = cleanMac(t.dev_id);
              if (tDevClean === serialClean) return true;
              if (tDevClean.length >= 10 && serialClean.length >= 10 && tDevClean.substring(0, 10) === serialClean.substring(0, 10)) return true;
              return false;
            });

            const isOnline = telem ? (telem.status === 'online') : false;
            const outletTds = telem?.tds2 !== null && telem?.tds2 !== undefined ? Number(telem.tds2) : (telem?.tds1 !== null && telem?.tds1 !== undefined ? Number(telem.tds1) : 85);
            const inletTds = telem?.tds1 !== null && telem?.tds1 !== undefined ? Number(telem.tds1) : null;
            const temp = telem?.temp ? Number(telem.temp) : 32.5;

            matchedDevices.push({
              id: a.serialNumber || a.id,
              serialNumber: a.serialNumber || 'SHD-PURIFIER',
              macAddress: a.serialNumber || '',
              name: item.name || 'Shuddham Smart Purifier',
              model: item.name || 'Smart IoT RO',
              category: item.category || 'Smart IoT RO',
              type: item.category || 'RO',
              location: a.installationAddress || 'Kitchen',
              installationAddress: a.installationAddress || '',
              status: isOnline ? 'online' : 'offline',
              isOnline: isOnline,
              tdsPpm: outletTds,
              inletTdsPpm: inletTds,
              temperature: temp,
              mode: telem?.mode || 'NF',
              fan: telem?.fan || 'enable',
              tdsRange: telem?.tds_range || 90,
              filterLifePercentage: 92,
              totalLitersPurified: 148.5,
              installedAt: a.installedAt || a.assignedDate || null,
              warrantyUntil: a.warrantyUntil || null,
              warrantyMonths: a.warrantyMonths || 12,
              assignedAdminName: a.adminName || '',
              customerName: a.customerName || '',
              customerPhone: a.customerPhone || '',
              customerEmail: a.customerEmail || '',
              lastSync: telem?.last_updated || telem?.ts || a.installedAt || new Date().toISOString()
            });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      count: matchedDevices.length,
      data: matchedDevices
    });
  } catch (err) {
    console.error('[GetCustomerDevices Error]', err);
    return res.status(500).json({ success: false, message: 'Server error fetching customer devices', error: err.message });
  }
};

/**
 * Get all devices in an Admin's custody
 * Returns both unassigned (in custody) and installed devices.
 */
export const getAdminCustodyDevices = async (req, res) => {
  try {
    const adminId = (req.params.adminId || req.query.adminId || '').toString().trim();
    const adminEmail = (req.query.email || '').toString().trim().toLowerCase();

    const items = await loadInventory();
    const inCustody = [];
    const installed = [];

    for (const item of items) {
      if (Array.isArray(item.assignments)) {
        for (const a of item.assignments) {
          const matchId = adminId && a.adminId && String(a.adminId).trim() === adminId;
          const matchEmail = adminEmail && a.adminEmail && String(a.adminEmail).trim().toLowerCase() === adminEmail;
          const matches = (!adminId && !adminEmail) || matchId || matchEmail;

          if (matches) {
            const entry = {
              ...a,
              itemName: item.name,
              itemCategory: item.category,
              inventoryId: item.id,
              sku: item.sku
            };

            if (a.status === 'Installed' || (a.customerPhone && a.customerPhone.trim())) {
              installed.push(entry);
            } else {
              inCustody.push(entry);
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      totalCount: inCustody.length + installed.length,
      inCustodyCount: inCustody.length,
      installedCount: installed.length,
      data: {
        inCustody,
        installed
      }
    });
  } catch (err) {
    console.error('[AdminCustody Error]', err);
    return res.status(500).json({ success: false, message: 'Server error fetching admin custody devices', error: err.message });
  }
};

/**
 * Track complete lifecycle of a physical device by its Serial Number / MAC
 */
export const getDeviceLifecycleBySerial = async (req, res) => {
  try {
    const serial = (req.params.serialNumber || req.query.serial || '').toString().trim();
    if (!serial) {
      return res.status(400).json({ success: false, message: 'Device serial number is required' });
    }

    const items = await loadInventory();
    let locationState = 'Unknown';
    let details = null;

    for (const item of items) {
      if (Array.isArray(item.availableSerials) && item.availableSerials.some(s => s.toUpperCase() === serial.toUpperCase())) {
        locationState = 'In Warehouse Stock';
        details = {
          stage: 'warehouse',
          itemName: item.name,
          sku: item.sku,
          category: item.category,
          warehouseLocation: item.location,
          status: 'Available'
        };
        break;
      }

      if (Array.isArray(item.assignments)) {
        const asgn = item.assignments.find(a => a.serialNumber && a.serialNumber.toUpperCase() === serial.toUpperCase());
        if (asgn) {
          if (asgn.status === 'Installed' || (asgn.customerPhone && asgn.customerPhone.trim())) {
            locationState = 'Installed at Customer';
            details = {
              stage: 'customer',
              itemName: item.name,
              sku: item.sku,
              assignmentId: asgn.id,
              assignedAdmin: { id: asgn.adminId, name: asgn.adminName, email: asgn.adminEmail },
              customer: {
                id: asgn.customerId,
                name: asgn.customerName,
                phone: asgn.customerPhone,
                email: asgn.customerEmail,
                address: asgn.installationAddress
              },
              installedAt: asgn.installedAt,
              warrantyUntil: asgn.warrantyUntil,
              warrantyMonths: asgn.warrantyMonths,
              status: asgn.status
            };
          } else {
            locationState = 'In Admin Custody';
            details = {
              stage: 'admin_custody',
              itemName: item.name,
              sku: item.sku,
              assignmentId: asgn.id,
              assignedAdmin: { id: asgn.adminId, name: asgn.adminName, email: asgn.adminEmail },
              allocatedDate: asgn.assignedDate,
              status: asgn.status
            };
          }
          break;
        }
      }
    }

    if (!details) {
      return res.status(404).json({
        success: false,
        message: `Device with serial '${serial}' was not found in inventory.`
      });
    }

    let telemetry = null;
    if (isMySQLActive()) {
      try {
        const tRows = await query('SELECT * FROM device_latest_telemetry WHERE dev_id = ? OR dev_id = ? LIMIT 1', [serial, cleanMac(serial)]);
        if (tRows && tRows.length > 0) telemetry = tRows[0];
      } catch (_) {}
    }

    return res.status(200).json({
      success: true,
      serialNumber: serial,
      currentLocation: locationState,
      details,
      telemetry
    });
  } catch (err) {
    console.error('[DeviceLifecycle Error]', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving device lifecycle', error: err.message });
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
      message: `Inventory item '${removed.name}' removed successfully.`,
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
