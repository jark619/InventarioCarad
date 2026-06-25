export type Product = { id: string; name: string; barcode: string | null; quantity: number; category: string | null; image_url: string | null; price: number; low_stock_threshold: number; is_active: boolean };
export type CartLine = Product & { units: number };
