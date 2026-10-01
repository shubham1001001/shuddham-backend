import express from 'express';
import {
  customerLogin,
  adminLogin,
  login,
  logout,
  createUser,
  signup,
  sendOtp,
  verifyOtp,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  updateUser,
  deleteUser,
  getAllAdminsList,
  getUserByIdEndpoint
} from '../controllers/authController.js';

const router = express.Router();

// 📱 1. Customer Authentication Endpoints (Mobile App)
router.post('/customer/login', customerLogin);
router.post('/customer/signup', signup);
router.post('/login', customerLogin); // Universal alias
router.post('/signup', signup); // Universal alias

// 💻 2. Admin Authentication Endpoints (Web Portal)
router.post('/admin/login', adminLogin);
router.post('/admin/create-admin', createUser);

// Common Auth Endpoints
router.post('/logout', logout);
router.post('/create-user', createUser);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/change-password', changePassword);

// Protected Profile Endpoints
router.get('/me', getMe);
router.put('/me', updateMe);
router.patch('/me', updateMe);

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

