// ─────────────────────────────────────────────────────────────────────────────
// Shuddham Water Solutions — Customer Support Tickets Controller
// ─────────────────────────────────────────────────────────────────────────────

let supportTickets = [
  {
    id: 'TCK-1001',
    customerName: 'Pooja Agarwal',
    customerPhone: '9800011122',
    subject: 'Filter replacement inquiry',
    message: 'Need to check RO membrane replacement due date and charges.',
    status: 'Open',
    priority: 'Normal',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
  }
];

export const createSupportTicket = (req, res) => {
  const { customerName, customerPhone, subject, message, priority } = req.body;

  if (!customerPhone || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: 'Customer phone, subject, and message are required'
    });
  }

  const newTicket = {
    id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName: customerName || 'Valued Customer',
    customerPhone,
    subject,
    message,
    status: 'Open',
    priority: priority || 'Normal',
    createdAt: new Date().toISOString()
  };

  supportTickets.unshift(newTicket);

  return res.status(201).json({
    success: true,
    message: 'Support ticket submitted successfully. Our team will contact you shortly.',
    data: newTicket
  });
};

export const getSupportTickets = (req, res) => {
  const { customerPhone, status } = req.query;
  let filtered = [...supportTickets];

  if (customerPhone) {
    const clean = customerPhone.replace(/\D/g, '').slice(-10);
    filtered = filtered.filter(t => t.customerPhone.replace(/\D/g, '').includes(clean));
  }

  if (status) {
    filtered = filtered.filter(t => t.status.toLowerCase() === status.toLowerCase());
  }

  return res.status(200).json({
    success: true,
    count: filtered.length,
    data: filtered
  });
};
