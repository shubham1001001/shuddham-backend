import express from 'express';
import { 
  getTechnicians, 
  getTechnicianById, 
  createTechnician,
  updateTechnicianStatus,
  updateTechnician,
  deleteTechnician 
} from '../controllers/techniciansController.js';

const router = express.Router();

router.get('/', getTechnicians);
router.post('/', createTechnician);
router.get('/:id', getTechnicianById);
router.patch('/:id/status', updateTechnicianStatus);
router.put('/:id', updateTechnician);
router.delete('/:id', deleteTechnician);

export default router;

