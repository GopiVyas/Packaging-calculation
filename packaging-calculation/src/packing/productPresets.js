/**
 * Realistic product presets with real-world dimensions in cm.
 * wallThickness applies to nestable hollow items (cups, jars) —
 * it controls how much vertical space is saved when nesting.
 */
export const PRODUCT_PRESETS = [
    // — Bottles —
    { name: 'Water Bottle 500ml', shape: 'bottle', length: 7, width: 7, height: 22, color: '#06b6d4', quantity: 12, icon: 'bottle' },
    { name: 'Water Bottle 1L', shape: 'bottle', length: 9, width: 9, height: 28, color: '#0891b2', quantity: 8, icon: 'bottle' },
    { name: 'Soda Bottle 1.5L', shape: 'bottle', length: 10, width: 10, height: 32, color: '#2563eb', quantity: 6, icon: 'bottle' },
    { name: 'Juice Bottle 250ml', shape: 'bottle', length: 5, width: 5, height: 15, color: '#f97316', quantity: 20, icon: 'bottle' },
    { name: 'Wine Bottle', shape: 'bottle', length: 8, width: 8, height: 30, color: '#7f1d1d', quantity: 6, icon: 'bottle' },
    // — Cups / Mugs (nestable) —
    { name: 'Coffee Cup 200ml', shape: 'cup', length: 7, width: 7, height: 10, color: '#f5f5f4', quantity: 24, icon: 'cup', wallThickness: 0.3 },
    { name: 'Coffee Mug', shape: 'cup', length: 9, width: 9, height: 11, color: '#1e293b', quantity: 12, icon: 'cup', wallThickness: 0.5 },
    { name: 'Tea Cup', shape: 'cup', length: 8, width: 8, height: 7, color: '#e7e5e4', quantity: 18, icon: 'cup', wallThickness: 0.3 },
    { name: 'Espresso Cup', shape: 'cup', length: 6, width: 6, height: 6, color: '#fef3c7', quantity: 30, icon: 'cup', wallThickness: 0.25 },
    { name: 'Paper Cup 100ml', shape: 'cup', length: 5.5, width: 5.5, height: 6.5, color: '#fafaf9', quantity: 50, icon: 'cup', wallThickness: 0.15 },
    { name: 'Plastic Cup 150ml', shape: 'cup', length: 6.5, width: 6.5, height: 8, color: '#e0f2fe', quantity: 40, icon: 'cup', wallThickness: 0.1 },
    // — Cans —
    { name: 'Soda Can 330ml', shape: 'can', length: 6.6, width: 6.6, height: 12.2, color: '#ef4444', quantity: 24, icon: 'can' },
    { name: 'Soda Can 500ml', shape: 'can', length: 8, width: 8, height: 16, color: '#dc2626', quantity: 12, icon: 'can' },
    { name: 'Energy Drink 250ml', shape: 'can', length: 5.3, width: 5.3, height: 13, color: '#0f766e', quantity: 24, icon: 'can' },
    // — Phones / Electronics —
    { name: 'Smartphone', shape: 'phone', length: 15, width: 7.5, height: 0.8, color: '#1f2937', quantity: 20, icon: 'phone' },
    { name: 'Phone (boxed)', shape: 'phone', length: 17, width: 9, height: 5, color: '#374151', quantity: 16, icon: 'phone' },
    { name: 'Tablet', shape: 'phone', length: 25, width: 18, height: 1, color: '#475569', quantity: 8, icon: 'phone' },
    { name: 'Earbuds Case', shape: 'phone', length: 8, width: 6, height: 3.5, color: '#f1f5f9', quantity: 30, icon: 'phone' },
    // — Packets / Boxes —
    { name: 'Cereal Packet', shape: 'packet', length: 20, width: 8, height: 28, color: '#f59e0b', quantity: 12, icon: 'packet' },
    { name: 'Snack Packet', shape: 'packet', length: 15, width: 8, height: 22, color: '#eab308', quantity: 24, icon: 'packet' },
    { name: 'Cookie Packet', shape: 'packet', length: 18, width: 6, height: 14, color: '#a16207', quantity: 18, icon: 'packet' },
    { name: 'Tea Box 100-bag', shape: 'packet', length: 22, width: 7, height: 10, color: '#16a34a', quantity: 12, icon: 'packet' },
    { name: 'Pasta Box', shape: 'packet', length: 12, width: 5, height: 25, color: '#ca8a04', quantity: 20, icon: 'packet' },
    { name: 'Shoe Box', shape: 'packet', length: 33, width: 21, height: 12, color: '#92400e', quantity: 4, icon: 'packet' },
    // — Pouches / Bags —
    { name: 'Coffee Pouch 250g', shape: 'pouch', length: 14, width: 8, height: 22, color: '#78350f', quantity: 16, icon: 'pouch' },
    { name: 'Chips Pouch', shape: 'pouch', length: 28, width: 5, height: 18, color: '#dc2626', quantity: 10, icon: 'pouch' },
    { name: 'Spice Pouch', shape: 'pouch', length: 10, width: 3, height: 15, color: '#ea580c', quantity: 30, icon: 'pouch' },
    // — Jars (nestable) —
    { name: 'Jam Jar 400g', shape: 'jar', length: 8, width: 8, height: 12, color: '#dc2626', quantity: 12, icon: 'jar', wallThickness: 0.4 },
    { name: 'Pickle Jar 1L', shape: 'jar', length: 11, width: 11, height: 18, color: '#65a30d', quantity: 6, icon: 'jar', wallThickness: 0.5 },
    { name: 'Honey Jar 500g', shape: 'jar', length: 9, width: 9, height: 11, color: '#d97706', quantity: 12, icon: 'jar', wallThickness: 0.35 },
    // — Spheres / Specialty —
    { name: 'Chocolate Sphere', shape: 'sphere', length: 5, width: 5, height: 5, color: '#8b5cf6', quantity: 24, icon: 'sphere' },
    { name: 'Orange (fruit)', shape: 'sphere', length: 7, width: 7, height: 7, color: '#f97316', quantity: 20, icon: 'sphere' },
    { name: 'Diamond Gift', shape: 'diamond', length: 6, width: 6, height: 8, color: '#06b6d4', quantity: 10, icon: 'diamond' },
];
export function createProductFromPreset(preset, index) {
    return {
        id: `preset-${Date.now()}-${index}`,
        name: preset.name,
        shape: preset.shape,
        length: preset.length,
        width: preset.width,
        height: preset.height,
        color: preset.color,
        quantity: preset.quantity,
        wallThickness: preset.wallThickness,
    };
}
