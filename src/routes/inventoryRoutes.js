import express from 'express';
import {
  getInventory,
  getInventoryStats,
  getInventoryItemById,
  createInventoryItem,
  bulkCreateInventoryItems,
  updateInventoryItem,
  adjustStock,
  deleteInventoryItem,
  assignDeviceToAdmin,
  unassignDevice,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/inventoryController.js';

const router = express.Router();

// Stats / Metrics
router.get('/stats', getInventoryStats);

// Device Categories CRUD (Placed before /:id so 'categories' is not captured as an id)
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// List & Create Items
router.get('/', getInventory);
router.post('/bulk', bulkCreateInventoryItems);
router.post('/', createInventoryItem);

// Single Item Operations
router.get('/:id', getInventoryItemById);
router.put('/:id', updateInventoryItem);
router.patch('/:id/adjust', adjustStock);
router.post('/:id/assign', assignDeviceToAdmin);
router.post('/:id/unassign', unassignDevice);
router.delete('/:id', deleteInventoryItem);

export default router;
