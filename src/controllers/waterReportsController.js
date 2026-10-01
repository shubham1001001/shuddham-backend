// ─────────────────────────────────────────────────────────────────────────────
// Shuddham Water Solutions — Water Reports & Purifier Diagnostics Controller
// ─────────────────────────────────────────────────────────────────────────────

const sampleReports = [
  {
    id: 'RPT-2026-09',
    reportTitle: 'Monthly Purity & TDS Audit',
    reportDate: '2026-09-15',
    tdsBefore: 420,
    tdsAfter: 45,
    purityPercentage: '99.8%',
    hardness: 'Soft (35 ppm)',
    phLevel: '7.4 (Optimal Alkaline)',
    filtersChecked: [
      { name: 'Sediment Filter', status: 'Healthy', lifePercent: 85 },
      { name: 'Pre-Carbon Filter', status: 'Healthy', lifePercent: 80 },
      { name: 'RO Membrane (75 GPD)', status: 'Optimal', lifePercent: 82 },
      { name: 'Post-Carbon / Mineral Cartridge', status: 'Optimal', lifePercent: 90 },
      { name: 'UV Sterilizer Chamber', status: 'Active (254nm)', lifePercent: 95 }
    ],
    overallFilterLife: 82,
    nextRecommendedServiceDays: 45,
    certifyingTechnician: 'Rajesh Sharma (Lead Tech)',
    fileDownloadUrl: 'https://shuddham.com/reports/audit-sep-2026.pdf'
  },
  {
    id: 'RPT-2026-08',
    reportTitle: 'New Machine Installation & Quality Baseline',
    reportDate: '2026-08-01',
    tdsBefore: 450,
    tdsAfter: 52,
    purityPercentage: '99.5%',
    hardness: 'Soft (40 ppm)',
    phLevel: '7.2',
    overallFilterLife: 100,
    nextRecommendedServiceDays: 90,
    certifyingTechnician: 'Amit Verma',
    fileDownloadUrl: 'https://shuddham.com/reports/install-aug-2026.pdf'
  }
];

export const getWaterReports = (req, res) => {
  return res.status(200).json({
    success: true,
    count: sampleReports.length,
    data: {
      purifierModel: 'Shuddham Mineral RO (7-Stage Heavy Duty)',
      filterHealth: 82,
      daysUntilNextService: 45,
      latestTds: 45,
      reports: sampleReports
    }
  });
};

export const getWaterReportById = (req, res) => {
  const report = sampleReports.find(r => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({ success: false, message: 'Report not found' });
  }
  return res.status(200).json({ success: true, data: report });
};
