import { query, isMySQLActive } from '../config/db.js';

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

export const getServices = async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM `services`';
    const params = [];
    if (category) {
      sql += ' WHERE LOWER(`category`) = LOWER(?)';
      params.push(category);
    }
    sql += ' ORDER BY `created_at` ASC';
    const rows = await query(sql, params);
    const services = Array.isArray(rows) ? rows.map(mapServiceRow) : [];
    return res.json({ success: true, count: services.length, data: services });
  } catch (err) {
    console.error('[Services Controller] MySQL Error:', err.message);
    return res.status(500).json({ success: false, message: 'Database error fetching services', error: err.message });
  }
};

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT * FROM `services` WHERE `id` = ? LIMIT 1', [id]);
    if (rows && rows.length > 0) {
      return res.json({ success: true, data: mapServiceRow(rows[0]) });
    }
    return res.status(404).json({ success: false, message: 'Service not found' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Database error', error: err.message });
  }
};

export const createService = async (req, res) => {
  try {
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

    return res.status(201).json({
      success: true,
      message: `Service '${newService.title}' created successfully`,
      data: newService
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create service', error: err.message });
  }
};

export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, price, duration, description, featured } = req.body;

    const rows = await query('SELECT * FROM `services` WHERE `id` = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    const current = mapServiceRow(rows[0]);

    const updated = {
      title: title !== undefined ? title.trim() : current.title,
      category: category !== undefined ? category.trim() : current.category,
      price: price !== undefined ? Number(price) : current.price,
      duration: duration !== undefined ? duration.trim() : current.duration,
      description: description !== undefined ? description.trim() : current.description,
      featured: featured !== undefined ? Boolean(featured) : current.featured
    };

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

    return res.json({
      success: true,
      message: `Service '${updated.title}' updated successfully`,
      data: { ...current, ...updated }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update service', error: err.message });
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT * FROM `services` WHERE `id` = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    const target = mapServiceRow(rows[0]);
    await query('DELETE FROM `services` WHERE `id` = ?', [id]);

    return res.json({
      success: true,
      message: `Service '${target.title}' deleted successfully`,
      data: target
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete service', error: err.message });
  }
};
