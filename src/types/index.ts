export interface ProductImage {
  id: number;
  url: string;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  size: string;
  tagline: string;
  description: string;
  ingredients: string[];
  heat: number;
  category: string;
  categories?: string[];
  image: string;
  images?: ProductImage[];
  featured?: boolean;
  /** Price in cents. Null when the product has no online price. */
  priceCents?: number | null;
  soldOnline?: boolean;
  /** True when switched off, or when a tracked count reaches 0. */
  soldOut?: boolean;
  /** Jars on hand. Null when Jesse doesn't track this product. */
  stockCount?: number | null;
}

export interface Event {
  id: number;
  name: string;
  date: string;
  end_date?: string | null;
  is_recurring?: boolean;
  recurrence_day?: string | null;
  time: string;
  location: string;
  address?: string;
  type: "market" | "festival" | "pop-up" | "class";
  description?: string;
}

/** A store that carries the jars, shown on the Find Us page. */
export interface RetailLocation {
  id: number;
  name: string;
  /** Full street address, linked to Google Maps on the page. */
  address: string;
  /** Opening hours as free text, like "Tue to Sun, 10am to 6pm". */
  hours: string | null;
  image_url: string | null;
  /** Where online orders are picked up. Shows an "Online order pickup" badge. */
  is_pickup_location: boolean;
  is_visible: boolean;
  sort_order: number;
}

export interface ClassInfo {
  title: string;
  price: number;
  duration: string;
  description: string;
  whatYouLearn: string[];
  whatYouGet: string[];
  maxStudents: number;
}

export interface Testimonial {
  id: number;
  quote: string;
  author: string;
  product?: string;
}