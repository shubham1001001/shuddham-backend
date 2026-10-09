import { query, initDatabase } from '../src/config/db.js';

const defaultServices = [
  {
    id: 'srv-tank-sanitization',
    title: 'Tank Sanitization',
    category: 'Tank Cleaning',
    price: 999.00,
    duration: '1-2 Hours',
    description: '4-Stage Deep Clean & Sanitization for overhead and underground water storage tanks using eco-friendly antibacterial agents.',
    featured: 1,
    rating: 4.9,
    review_count: 142
  },
  {
    id: 'srv-ro-complete-service',
    title: 'RO Complete Service',
    category: 'Purifier Maintenance',
    price: 499.00,
    duration: '1 Hour',
    description: 'Complete RO checkup including sediment flush, pre-carbon inspection, leak tests, and precision digital TDS calibration.',
    featured: 1,
    rating: 4.8,
    review_count: 284
  },
  {
    id: 'srv-membrane-change',
    title: 'Membrane Change',
    category: 'Filter Replacement',
    price: 1899.00,
    duration: '45 Mins',
    description: 'Genuine high-rejection 80 GPD / 100 GPD RO membrane replacement suitable for input TDS up to 2500 ppm.',
    featured: 0,
    rating: 4.9,
    review_count: 98
  },
  {
    id: 'srv-tds-water-test',
    title: 'TDS Water Test',
    category: 'Water Quality Check',
    price: 299.00,
    duration: '30 Mins',
    description: 'On-site 8-point lab check including TDS, pH, hardness, chlorine, and heavy mineral presence by certified water technician.',
    featured: 0,
    rating: 4.7,
    review_count: 76
  },
  {
    id: 'srv-filter-cartridge-swap',
    title: 'Filter Cartridge Replacement',
    category: 'Filter Replacement',
    price: 799.00,
    duration: '45 Mins',
    description: 'Replacement of spun polypropylene sediment filter and activated carbon block filter for clear, odorless water.',
    featured: 1,
    rating: 4.8,
    review_count: 119
  }
];

async function seed() {
  await initDatabase();
  for (const s of defaultServices) {
    await query(`
      INSERT INTO services 
        (id, title, category, price, duration, description, featured, rating, review_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        category = VALUES(category),
        price = VALUES(price),
        duration = VALUES(duration),
        description = VALUES(description),
        featured = VALUES(featured),
        rating = VALUES(rating),
        review_count = VALUES(review_count)
    `, [
      s.id,
      s.title,
      s.category,
      s.price,
      s.duration,
      s.description,
      s.featured,
      s.rating,
      s.review_count
    ]);
    console.log(`Seeded service: ${s.title} (${s.id})`);
  }
  console.log('Seeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
