export const initialServices = [
  {
    id: 'srv-1',
    title: 'Water Tank Deep Cleaning & Sterilization',
    category: 'Tank Cleaning',
    price: 999,
    duration: '2 Hours',
    description: 'High-pressure vacuum cleaning, sludge removal, antibacterial UV treatment for underground and overhead tanks.',
    featured: true,
    rating: 4.9,
    reviewCount: 320
  },
  {
    id: 'srv-2',
    title: 'Complete RO Purifier Servicing',
    category: 'RO Service',
    price: 499,
    duration: '45 Mins',
    description: 'Full inspection, TDS check, sediment flushing, pre-filter replacement, and leakage testing.',
    featured: true,
    rating: 4.8,
    reviewCount: 540
  },
  {
    id: 'srv-3',
    title: 'Smart RO Device Installation & IoT Setup',
    category: 'Installation',
    price: 799,
    duration: '1.5 Hours',
    description: 'Complete unboxing, wall-mounting, plumbing inlet push-fit connection, mobile IoT app pairing, and certified TDS calibration.',
    featured: true,
    rating: 4.9,
    reviewCount: 215
  },
  {
    id: 'srv-4',
    title: 'UV Lamp & SMPS Power Repair',
    category: 'Repair',
    price: 749,
    duration: '40 Mins',
    description: 'Diagnosis and replacement of Philips UV disinfection tube, ballast, and power adapter circuit.',
    featured: false,
    rating: 4.7,
    reviewCount: 98
  },
  {
    id: 'srv-5',
    title: 'Water Hardness & TDS Lab Testing',
    category: 'Water Quality',
    price: 299,
    duration: '30 Mins',
    description: 'Comprehensive 8-parameter on-site water quality analysis with certified digital report.',
    featured: false,
    rating: 4.9,
    reviewCount: 140
  }
];

export const initialTechnicians = [];

export const initialBookings = [
  {
    id: 'BK-1081',
    customerName: 'Pooja Agarwal',
    customerPhone: '+91 99887 76655',
    serviceTitle: 'Water Tank Deep Cleaning & Sterilization',
    address: 'Flat 402, Green Valley Heights, Sector 21',
    date: '2026-09-24',
    timeSlot: '10:00 AM - 12:00 PM',
    status: 'Confirmed',
    technicianId: 'tech-2',
    technicianName: 'Vikram Patel',
    amount: 999,
    paymentStatus: 'Paid (UPI)',
    tdsBefore: null,
    tdsAfter: null
  },
  {
    id: 'BK-1082',
    customerName: 'Deepak Mehrotra',
    customerPhone: '+91 98223 34455',
    serviceTitle: 'Complete RO Purifier Servicing',
    address: 'B-12, Royal Palms Society',
    date: '2026-09-24',
    timeSlot: '02:00 PM - 03:00 PM',
    status: 'Assigned',
    technicianId: 'tech-1',
    technicianName: 'Rajesh Sharma',
    amount: 499,
    paymentStatus: 'Pending (Cash on Service)',
    tdsBefore: 680,
    tdsAfter: null
  },
  {
    id: 'BK-1083',
    customerName: 'Ananya Deshmukh',
    customerPhone: '+91 97334 45566',
    serviceTitle: 'RO Membrane & Filter Replacement',
    address: 'Villa 7, Silver Woods Enclave',
    date: '2026-09-23',
    timeSlot: '11:00 AM - 12:00 PM',
    status: 'Completed',
    technicianId: 'tech-3',
    technicianName: 'Amit Verma',
    amount: 1899,
    paymentStatus: 'Paid (Card)',
    tdsBefore: 750,
    tdsAfter: 85
  },
  {
    id: 'BK-1084',
    customerName: 'Kunal Singhania',
    customerPhone: '+91 96554 33221',
    serviceTitle: 'Water Hardness & TDS Lab Testing',
    address: 'House 54, Phase 2, Lakeview Gardens',
    date: '2026-09-25',
    timeSlot: '04:00 PM - 05:00 PM',
    status: 'Pending',
    technicianId: null,
    technicianName: 'Unassigned',
    amount: 299,
    paymentStatus: 'Pending',
    tdsBefore: null,
    tdsAfter: null
  }
];

export const initialCategories = [
  {
    id: 'cat-1',
    name: 'Smart IoT RO',
    description: 'Wi-Fi & Bluetooth connected smart purifiers with live TDS monitoring',
    icon: 'Cpu',
    createdAt: '2026-09-01'
  },
  {
    id: 'cat-2',
    name: 'Alkaline & Mineral RO',
    description: 'Multi-stage purifiers with active Copper, Zinc & pH booster technology',
    icon: 'Droplets',
    createdAt: '2026-09-01'
  },
  {
    id: 'cat-3',
    name: 'Under-Sink Compact RO',
    description: 'Space-saving concealed hydro-filtration units with dedicated faucets',
    icon: 'Box',
    createdAt: '2026-09-01'
  },
  {
    id: 'cat-4',
    name: 'Commercial RO Plants',
    description: 'High LPH multi-membrane filtration systems for schools, cafes & offices',
    icon: 'Building2',
    createdAt: '2026-09-01'
  },
  {
    id: 'cat-5',
    name: 'UV + UF Purifiers',
    description: 'Zero-wastage non-RO ultraviolet and ultrafiltration systems for low TDS water',
    icon: 'ShieldCheck',
    createdAt: '2026-09-01'
  }
];

export const initialInventory = [];


