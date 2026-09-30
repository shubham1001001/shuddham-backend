import { getCreatedAdmins } from '../data/usersData.js';

export const getTechnicians = async (req, res) => {
  try {
    const admins = await getCreatedAdmins();
    const { status } = req.query;
    if (status) {
      const filtered = admins.filter(t => t.status && t.status.toLowerCase() === status.toLowerCase());
      return res.json({ success: true, count: filtered.length, data: filtered });
    }
    return res.json({ success: true, count: admins.length, data: admins });
  } catch (error) {
    console.error('[TechniciansController] Error fetching team members:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve team members from database',
      error: error.message
    });
  }
};

export const getTechnicianById = async (req, res) => {
  try {
    const admins = await getCreatedAdmins();
    const tech = admins.find(t => t.id === req.params.id);
    if (!tech) {
      return res.status(404).json({ success: false, message: 'Member not found in database' });
    }
    return res.json({ success: true, data: tech });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTechnicianStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const admins = await getCreatedAdmins();
    const tech = admins.find(t => t.id === id);
    if (!tech) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    if (status) tech.status = status;
    return res.json({ success: true, message: 'Status updated', data: tech });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export { updateUser as updateTechnician, deleteUser as deleteTechnician } from './authController.js';


