const fs = require('fs');
const path = require('path');

// 1. Read FakeStoreAPI content
const fakeStorePath = 'C:\\Users\\adars\\.gemini\\antigravity-ide\\brain\\34d96a8f-5d6d-4dd7-a878-e4bd1cb1a051\\.system_generated\\steps\\262\\content.md';
const fakeStoreRaw = fs.readFileSync(fakeStorePath, 'utf8');
const fakeStoreJsonMatch = fakeStoreRaw.match(/\[\s*\{.*\}\s*\]/s);
const fakeStoreProducts = fakeStoreJsonMatch ? JSON.parse(fakeStoreJsonMatch[0]) : [];

// 2. Read DummyJSON content
const dummyJsonPath = 'C:\\Users\\adars\\.gemini\\antigravity-ide\\brain\\34d96a8f-5d6d-4dd7-a878-e4bd1cb1a051\\.system_generated\\steps\\260\\content.md';
const dummyJsonRaw = fs.readFileSync(dummyJsonPath, 'utf8');
const dummyJsonMatch = dummyJsonRaw.match(/\{"products":\s*\[.*\]\}/s);
const dummyJsonData = dummyJsonMatch ? JSON.parse(dummyJsonMatch[0]) : { products: [] };
const dummyProducts = dummyJsonData.products || [];

console.log(`Parsed ${fakeStoreProducts.length} from FakeStoreAPI, ${dummyProducts.length} from DummyJSON`);

// Helper to determine price band
function getPriceBand(priceInRupees) {
  if (priceInRupees <= 2000) return 'budget';
  if (priceInRupees <= 8000) return 'mid';
  return 'premium';
}

// USD to INR conversion rate approx ₹85, rounded to clean price points
function usdToInr(usd) {
  const inr = Math.round(usd * 85);
  // Round to nearest 9 or 99 or 49
  if (inr < 500) return Math.max(99, Math.round(inr / 10) * 10 - 1);
  if (inr < 2000) return Math.round(inr / 50) * 50 - 1;
  return Math.round(inr / 100) * 100 - 5;
}

// Category mapping helper
function mapFakeStoreCategory(cat, title) {
  const c = cat.toLowerCase();
  const t = title.toLowerCase();
  if (c === 'electronics') {
    if (t.includes('ssd') || t.includes('hard drive') || t.includes('drive')) return 'Storage';
    if (t.includes('gaming') || t.includes('monitor') || t.includes('curved')) return 'Gaming';
    return 'Peripherals';
  }
  if (c === 'jewelery') return 'Wearables';
  if (c === "men's clothing") {
    if (t.includes('shoe') || t.includes('sneaker') || t.includes('boot')) return 'Footwear';
    return 'Apparel';
  }
  if (c === "women's clothing") {
    if (t.includes('shoe') || t.includes('sneaker') || t.includes('boot')) return 'Footwear';
    return 'Apparel';
  }
  return 'Apparel';
}

function mapDummyJsonCategory(cat, title) {
  const c = cat.toLowerCase();
  const t = title.toLowerCase();
  if (c === 'beauty' || c === 'skin-care') return 'Beauty';
  if (c === 'fragrances') return 'Fragrances';
  if (c === 'furniture' || c === 'home-decoration') return 'Home & Living';
  if (c === 'groceries' || c === 'kitchen-accessories') return 'Groceries';
  if (c === 'laptops') return 'Peripherals';
  if (c === 'smartphones' || c === 'tablets') return 'Electronics';
  if (c === 'mobile-accessories') return 'Peripherals';
  if (c === 'mens-shoes' || c === 'womens-shoes') return 'Footwear';
  if (c === 'mens-watches' || c === 'womens-watches' || c === 'womens-jewellery') return 'Wearables';
  if (c === 'mens-shirts' || c === 'tops' || c === 'womens-dresses' || c === 'womens-bags') return 'Apparel';
  if (c === 'sports-accessories') return 'Gaming';
  if (c === 'sunglasses') return 'Wearables';
  if (c === 'motorcycle' || c === 'vehicle') return 'Automotive';
  return 'Electronics';
}

const convertedFakeStore = fakeStoreProducts.map((p) => {
  const inrPrice = usdToInr(p.price);
  const origPrice = Math.round(inrPrice * 1.25);
  const discount = Math.round(((origPrice - inrPrice) / origPrice) * 100);
  const category = mapFakeStoreCategory(p.category, p.title);
  const id = `prod_fs_${p.id}`;
  
  // Extract brand from title
  const brand = p.title.split(' ')[0].replace(/[^a-zA-Z]/g, '') || 'PrimeStore';

  const specs = [
    `Category: ${p.category}`,
    `Original Import Item #${p.id}`,
    p.rating ? `Customer Rating: ${p.rating.rate} / 5` : 'Verified Quality',
    'Free Express Delivery'
  ];

  const ratingVal = p.rating ? Number(p.rating.rate.toFixed(1)) : 4.2;
  const reviewsVal = p.rating ? p.rating.count * 8 : 150;

  return {
    id,
    name: p.title.trim(),
    brand,
    category,
    price: inrPrice * 100,
    displayPrice: inrPrice,
    originalPrice: origPrice,
    discountPercent: discount,
    rating: ratingVal,
    reviewsCount: reviewsVal,
    inStock: true,
    stockCount: 45,
    badge: ratingVal >= 4.5 ? 'Top Rated' : discount > 20 ? 'Special Offer' : undefined,
    description: p.description.replace(/\n+/g, ' ').slice(0, 200) + '...',
    specs,
    imageUrl: p.image,
    priceBand: getPriceBand(inrPrice),
    reviewSummary: `${p.title} has a ${ratingVal} / 5 rating from ${reviewsVal} customers. ${p.description.slice(0, 100)}...`
  };
});

const convertedDummyJson = dummyProducts.map((p) => {
  const inrPrice = usdToInr(p.price);
  const discount = Math.round(p.discountPercentage || 15);
  const origPrice = Math.round(inrPrice * (1 + discount / 100));
  const category = mapDummyJsonCategory(p.category, p.title);
  const id = `prod_dj_${p.id}`;
  const brand = p.brand || p.title.split(' ')[0] || 'PrimeStore';

  const specs = [
    ...(p.tags ? p.tags.slice(0, 2).map(t => `Tag: ${t}`) : []),
    p.warrantyInformation || '1 Year Brand Warranty',
    p.shippingInformation || 'Ships in 2-3 Days',
    `SKU: ${p.sku || id}`
  ];

  const ratingVal = p.rating ? Number(p.rating.toFixed(1)) : 4.3;
  const reviewsVal = (p.reviews && p.reviews.length > 0) ? p.reviews.length * 45 : 85;

  return {
    id,
    name: p.title.trim(),
    brand,
    category,
    price: inrPrice * 100,
    displayPrice: inrPrice,
    originalPrice: origPrice,
    discountPercent: discount,
    rating: ratingVal,
    reviewsCount: reviewsVal,
    inStock: p.stock > 0,
    stockCount: p.stock || 20,
    badge: ratingVal >= 4.5 ? 'Best Seller' : p.stock < 10 ? 'Limited Stock' : undefined,
    description: p.description.replace(/\n+/g, ' '),
    specs: specs.slice(0, 4),
    imageUrl: (p.images && p.images[0]) || p.thumbnail,
    priceBand: getPriceBand(inrPrice),
    reviewSummary: `${p.title} by ${brand} is rated ${ratingVal} out of 5 stars with ${reviewsVal} customer reviews. ${p.description}`
  };
});

fs.writeFileSync(
  path.join(__dirname, 'imported_raw.json'),
  JSON.stringify({ fakeStore: convertedFakeStore, dummyJson: convertedDummyJson }, null, 2)
);
console.log('Successfully exported converted products to imported_raw.json');
