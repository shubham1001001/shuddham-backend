import express from 'express';
import healthRoutes from './healthRoutes.js';
import servicesRoutes from './servicesRoutes.js';
import bookingsRoutes from './bookingsRoutes.js';
import techniciansRoutes from './techniciansRoutes.js';
import statsRoutes from './statsRoutes.js';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import supportRoutes from './supportRoutes.js';
import waterReportsRoutes from './waterReportsRoutes.js';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/inventoryController.js';

const router = express.Router();

const categoryRouter = express.Router();
categoryRouter.get('/', getCategories);
categoryRouter.post('/', createCategory);
categoryRouter.put('/:id', updateCategory);
categoryRouter.delete('/:id', deleteCategory);

router.use('/auth', authRoutes);
router.use('/admins', adminRoutes);
router.use('/admin', adminRoutes);
router.use('/health', healthRoutes);
router.use('/services', servicesRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/technicians', techniciansRoutes);
router.use('/stats', statsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/categories', categoryRouter);
router.use('/support', supportRoutes);
router.use('/water-reports', waterReportsRoutes);

export default router;

