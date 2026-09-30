import { initialServices } from '../data/mockData.js';

let services = [...initialServices];

export const getServices = (req, res) => {
  const { category } = req.query;
  if (category) {
    const filtered = services.filter(s => s.category.toLowerCase() === category.toLowerCase());
    return res.json({ success: true, count: filtered.length, data: filtered });
  }
  res.json({ success: true, count: services.length, data: services });
};

export const getServiceById = (req, res) => {
  const service = services.find(s => s.id === req.params.id);
  if (!service) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }
  res.json({ success: true, data: service });
};

export const createService = (req, res) => {
  const { title, category, price, duration, description } = req.body;
  if (!title || !category || !price) {
    return res.status(400).json({ success: false, message: 'Title, category, and price are required' });
  }
  const newService = {
    id: `srv-${Date.now()}`,
    title,
    category,
    price: Number(price),
    duration: duration || '1 Hour',
    description: description || '',
    featured: false,
    rating: 5.0,
    reviewCount: 0
  };
  services.push(newService);
  res.status(201).json({ success: true, message: 'Service created successfully', data: newService });
};
