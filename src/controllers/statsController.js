import { initialServices, initialTechnicians, initialBookings } from '../data/mockData.js';

export const getDashboardStats = (req, res) => {
  const totalBookings = initialBookings.length;
  const completedBookings = initialBookings.filter(b => b.status === 'Completed').length;
  const activeBookings = initialBookings.filter(b => b.status === 'Confirmed' || b.status === 'Assigned').length;
  const availableTechnicians = initialTechnicians.filter(t => t.status === 'Available').length;
  const totalRevenue = initialBookings.reduce((sum, b) => sum + (b.paymentStatus.includes('Paid') ? b.amount : 0), 0);

  res.json({
    success: true,
    data: {
      totalBookings,
      completedBookings,
      activeBookings,
      availableTechnicians,
      totalRevenue,
      waterTanksCleanedThisMonth: 84,
      avgTdsReductionPercent: 88,
      satisfactionRate: 98.4
    }
  });
};
