import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialServices } from '../data/mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const SERVICES_FILE = path.join(DATA_DIR, 'database_services.json');

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

export const getServices = (req, res) => {
  const services = loadServicesDisk();
  const { category } = req.query;
  if (category) {
    const filtered = services.filter(s => s.category.toLowerCase() === category.toLowerCase());
    return res.json({ success: true, count: filtered.length, data: filtered });
  }
  res.json({ success: true, count: services.length, data: services });
};

export const getServiceById = (req, res) => {
  const services = loadServicesDisk();
  const service = services.find(s => s.id === req.params.id);
  if (!service) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }
  res.json({ success: true, data: service });
};

export const createService = (req, res) => {
  const { title, category, price, duration, description, featured } = req.body;
  if (!title || !category || price === undefined) {
    return res.status(400).json({ success: false, message: 'Title, category, and price are required' });
  }

  const services = loadServicesDisk();
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

  services.push(newService);
  saveServicesDisk(services);

  res.status(201).json({
    success: true,
    message: `Service '${newService.title}' created successfully`,
    data: newService
  });
};

export const updateService = (req, res) => {
  const { id } = req.params;
  const { title, category, price, duration, description, featured } = req.body;

  const services = loadServicesDisk();
  const index = services.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }

  const current = services[index];
  const updated = {
    ...current,
    title: title !== undefined ? title.trim() : current.title,
    category: category !== undefined ? category.trim() : current.category,
    price: price !== undefined ? Number(price) : current.price,
    duration: duration !== undefined ? duration.trim() : current.duration,
    description: description !== undefined ? description.trim() : current.description,
    featured: featured !== undefined ? Boolean(featured) : current.featured
  };

  services[index] = updated;
  saveServicesDisk(services);

  res.json({
    success: true,
    message: `Service '${updated.title}' updated successfully`,
    data: updated
  });
};

export const deleteService = (req, res) => {
  const { id } = req.params;
  const services = loadServicesDisk();
  const index = services.findIndex(s => s.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }

  const removed = services.splice(index, 1)[0];
  saveServicesDisk(services);

  res.json({
    success: true,
    message: `Service '${removed.title}' deleted successfully`,
    data: removed
  });
};
