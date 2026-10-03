import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialServices } from '../data/mockData.js';
import { query, isMySQLActive } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const SERVICES_FILE = path.join(DATA_DIR, 'database_services.json');

function mapServiceRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    price: Number(row.price),
    duration: row.duration,
    description: row.description,
    featured: Boolean(row.featured),
    rating: parseFloat(row.rating),
    reviewCount: row.review_count !== undefined ? row.review_count : row.reviewCount || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function loadServicesDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SERVICES_FILE)) {
      fs.writeFileSync(SERVICES_FILE, JSON.stringify(initialServices, null, 2), 'utf-8');
      return [...initialServices];
    }
    const raw = fs.readFileSync(SERVICES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [...initialServices];
  } catch (err) {
    console.error('[Services DB] Error loading services:', err.message);
    return [...initialServices];
  }
}

function saveServicesDisk(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SERVICES_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Services DB] Error saving services:', err.message);
    return false;
  }
}

export const getServices = async (req, res) => {
  const { category } = req.query;

  if (isMySQLActive()) {
    try {
      let sql = 'SELECT * FROM `services`';
      const params = [];
      if (category) {
        sql += ' WHERE LOWER(`category`) = LOWER(?)';
        params.push(category);
      }
      sql += ' ORDER BY `created_at` ASC';
      const rows = await query(sql, params);
      const services = rows.map(mapServiceRow);
      // Sync disk cache in background
      saveServicesDisk(services);
      return res.json({ success: true, count: services.length, data: services });
    } catch (err) {
      console.warn('[Services MySQL] Query error, falling back to disk:', err.message);
    }
  }

  const services = loadServicesDisk();
  if (category) {
    const filtered = services.filter(s => s.category.toLowerCase() === category.toLowerCase());
    return res.json({ success: true, count: filtered.length, data: filtered });
  }
  res.json({ success: true, count: services.length, data: services });
};

export const getServiceById = async (req, res) => {
  const { id } = req.params;

  if (isMySQLActive()) {
    try {
      const rows = await query('SELECT * FROM `services` WHERE `id` = ? LIMIT 1', [id]);
      if (rows && rows.length > 0) {
        return res.json({ success: true, data: mapServiceRow(rows[0]) });
      }
      return res.status(404).json({ success: false, message: 'Service not found' });
    } catch (err) {
      console.warn('[Services MySQL] Query by id error, falling back to disk:', err.message);
    }
  }

  const services = loadServicesDisk();
  const service = services.find(s => s.id === id);
  if (!service) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }
  res.json({ success: true, data: service });
};

export const createService = async (req, res) => {
  const { title, category, price, duration, description, featured } = req.body;
  if (!title || !category || price === undefined) {
    return res.status(400).json({ success: false, message: 'Title, category, and price are required' });
  }

  const newService = {
    id: `srv-${Date.now()}`,
    title: title.trim(),
    category: category.trim(),
    price: Number(price),
    duration: duration ? duration.trim() : '1 Hour',
    description: description ? description.trim() : '',
    featured: Boolean(featured),
    rating: 5.0,
    reviewCount: 0
  };

  if (isMySQLActive()) {
    try {
      await query(`
        INSERT INTO \`services\` (
          \`id\`, \`title\`, \`category\`, \`price\`, \`duration\`, \`description\`, \`featured\`, \`rating\`, \`review_count\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newService.id,
        newService.title,
        newService.category,
        newService.price,
        newService.duration,
        newService.description,
        newService.featured ? 1 : 0,
        newService.rating,
        newService.reviewCount
      ]);
    } catch (err) {
      console.error('[Services MySQL] Insert error:', err.message);
    }
  }

  // Also sync disk cache
  const services = loadServicesDisk();
  services.push(newService);
  saveServicesDisk(services);

  res.status(201).json({
    success: true,
    message: `Service '${newService.title}' created successfully`,
    data: newService
  });
};

export const updateService = async (req, res) => {
  const { id } = req.params;
  const { title, category, price, duration, description, featured } = req.body;

  let current = null;
  const services = loadServicesDisk();
  const index = services.findIndex(s => s.id === id);

  if (isMySQLActive()) {
    try {
      const rows = await query('SELECT * FROM `services` WHERE `id` = ? LIMIT 1', [id]);
      if (rows && rows.length > 0) {
        current = mapServiceRow(rows[0]);
      }
    } catch (err) {
      console.warn('[Services MySQL] Get current before update error:', err.message);
    }
  }

  if (!current) {
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    current = services[index];
  }

  const updated = {
    ...current,
    title: title !== undefined ? title.trim() : current.title,
    category: category !== undefined ? category.trim() : current.category,
    price: price !== undefined ? Number(price) : current.price,
    duration: duration !== undefined ? duration.trim() : current.duration,
    description: description !== undefined ? description.trim() : current.description,
    featured: featured !== undefined ? Boolean(featured) : current.featured
  };

  if (isMySQLActive()) {
    try {
      await query(`
        UPDATE \`services\`
        SET \`title\` = ?,
            \`category\` = ?,
            \`price\` = ?,
            \`duration\` = ?,
            \`description\` = ?,
            \`featured\` = ?,
            \`updated_at\` = CURRENT_TIMESTAMP
        WHERE \`id\` = ?
      `, [
        updated.title,
        updated.category,
        updated.price,
        updated.duration,
        updated.description,
        updated.featured ? 1 : 0,
        id
      ]);
    } catch (err) {
      console.error('[Services MySQL] Update error:', err.message);
    }
  }

  // Sync to disk
  if (index !== -1) {
    services[index] = updated;
  } else {
    services.push(updated);
  }
  saveServicesDisk(services);

  res.json({
    success: true,
    message: `Service '${updated.title}' updated successfully`,
    data: updated
  });
};

export const deleteService = async (req, res) => {
  const { id } = req.params;

  let removed = null;
  const services = loadServicesDisk();
  const index = services.findIndex(s => s.id === id);
  if (index !== -1) {
    removed = services.splice(index, 1)[0];
    saveServicesDisk(services);
  }

  if (isMySQLActive()) {
    try {
      if (!removed) {
        const rows = await query('SELECT * FROM `services` WHERE `id` = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          removed = mapServiceRow(rows[0]);
        }
      }
      await query('DELETE FROM `services` WHERE `id` = ?', [id]);
    } catch (err) {
      console.error('[Services MySQL] Delete error:', err.message);
    }
  }

  if (!removed) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }

  res.json({
    success: true,
    message: `Service '${removed.title}' deleted successfully`,
    data: removed
  });
};
