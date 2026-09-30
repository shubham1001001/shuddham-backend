import express from 'express';
import {
  login,
  logout,
  createUser,
  signup,
  sendOtp,
  verifyOtp,
  getMe,
  forgotPassword,
  updateUser,
  deleteUser,
  getAllAdminsList,
  getUserByIdEndpoint
} from '../controllers/authController.js';

const router = express.Router();

// Public Authentication Endpoints
router.post('/login', login);
router.post('/logout', logout);
router.post('/create-user', createUser);
router.post('/signup', signup); // alias for backwards compatibility
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);

// Protected Profile Endpoint
router.get('/me', getMe);

// Administrator Management Endpoints (Users / Admins CRUD)
router.get('/users', getAllAdminsList);
router.get('/users/:id', getUserByIdEndpoint);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Direct /admin and /admins route aliases on auth
router.get('/admin', getAllAdminsList);
router.get('/admin/:id', getUserByIdEndpoint);
router.put('/admin/:id', updateUser);
router.delete('/admin/:id', deleteUser);

export default router;

