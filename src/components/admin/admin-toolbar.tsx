"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  ShoppingBasket,
  Tags,
  CalendarDays,
  MessageSquareQuote,
  GraduationCap,
  Image as ImageIcon,
  Pencil,
  ChevronRight,
} from "lucide-react";

function getContextualLinks(pathname: string) {
  // Map public routes to their admin counterparts
  if (pathname === "/") {
    return { label: "Edit Dashboard", href: "/admin", icon: LayoutDashboard };
  }
  if (pathname === "/products" || pathname.startsWith("/products/")) {
    return { label: "Edit Products", href: "/admin/products", icon: ShoppingBasket };
  }
  if (pathname === "/events") {
    return { label: "Edit Events", href: "/admin/events", icon: CalendarDays };
  }
  if (pathname === "/learn-to-preserve") {
    return { label: "Edit Class Info", href: "/admin/class", icon: GraduationCap };
  }
  if (pathname === "/gallery") {
    return { label: "Edit Gallery", href: "/admin/gallery", icon: ImageIcon };
  }
  if (pathname === "/about") {
    return { label: "Dashboard", href: "/admin", icon: LayoutDashboard };
  }
  if (pathname === "/contact") {
    return { label: "Dashboard", href: "/admin", icon: LayoutDashboard };
  }
  return { label: "Dashboard", href: "/admin", icon: LayoutDashboard };
}

export function AdminToolbar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAdmin(!!user);
      setLoading(false);
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Add/remove body class to push fixed header down when toolbar is visible
  useEffect(() => {
    if (isAdmin) {
      document.body.classList.add("admin-toolbar-active");
    } else {
      document.body.classList.remove("admin-toolbar-active");
    }
    return () => document.body.classList.remove("admin-toolbar-active");
  }, [isAdmin]);

  if (loading || !isAdmin) return null;

  const contextual = getContextualLinks(pathname);

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-zinc-900 border-b border-zinc-700 text-zinc-300 text-sm h-10 flex items-center px-4 shadow-lg">
      {/* Left side - Brand & Dashboard */}
      <div className="flex items-center gap-1">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-800 hover:text-white transition-colors font-semibold text-green-500"
        >
          <LayoutDashboard className="w-4 h-4" />
          Big Sexy&apos;s Admin
        </Link>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-zinc-700 mx-2" />

      {/* Quick nav links */}
      <div className="flex items-center gap-0.5">
        <Link
          href="/admin/products"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <ShoppingBasket className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Products</span>
        </Link>
        <Link
          href="/admin/categories"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <Tags className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Categories</span>
        </Link>
        <Link
          href="/admin/events"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Events</span>
        </Link>
        <Link
          href="/admin/testimonials"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <MessageSquareQuote className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Testimonials</span>
        </Link>
        <Link
          href="/admin/class"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Class</span>
        </Link>
        <Link
          href="/admin/gallery"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Gallery</span>
        </Link>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side - Contextual edit link */}
      <div className="flex items-center gap-2">
        <Link
          href={contextual.href}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-700/30 hover:bg-green-700/50 text-green-400 hover:text-green-300 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          {contextual.label}
          <ChevronRight className="w-3 h-3" />
        </Link>

        {/* View site link */}
        <Link
          href="/"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 hover:text-white transition-colors"
        >
          View Site
        </Link>
      </div>
    </div>
  );
}
