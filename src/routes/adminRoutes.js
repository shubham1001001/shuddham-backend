import express from 'express';
import {
  createUser,
  updateUser,
  deleteUser,
  getAllAdminsList,
  getUserByIdEndpoint
} from '../controllers/authController.js';

const router = express.Router();

// Administrator Management Endpoints
router.get('/', getAllAdminsList);
router.get('/:id', getUserByIdEndpoint);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
