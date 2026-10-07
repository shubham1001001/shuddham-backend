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
import customerRoutes from './customerRoutes.js';
import firmwaresRoutes from './firmwaresRoutes.js';
import telemetryRoutes from './telemetryRoutes.js';
import addressesRoutes from './addressesRoutes.js';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/inventoryController.js';
import { getAllUsersDirectory } from '../controllers/authController.js';

const router = express.Router();

const categoryRouter = express.Router();
categoryRouter.get('/', getCategories);
categoryRouter.post('/', createCategory);
categoryRouter.put('/:id', updateCategory);
categoryRouter.delete('/:id', deleteCategory);

router.get('/users', getAllUsersDirectory);
router.use('/customer', customerRoutes);
router.use('/addresses', addressesRoutes);
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
router.use('/firmwares', firmwaresRoutes);
router.use('/telemetry', telemetryRoutes);
router.use('/devices', telemetryRoutes);

export default router;
