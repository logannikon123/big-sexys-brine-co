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
  soldOut?: boolean;
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