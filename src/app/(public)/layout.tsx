import { Toaster } from "sonner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LocalBusinessJsonLd } from "@/components/seo/JsonLd";
import { AdminToolbar } from "@/components/admin/admin-toolbar";
import { CartProvider } from "@/components/cart/CartProvider";
import { getOrderingAvailable } from "@/lib/data";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const orderingAvailable = await getOrderingAvailable();

  return (
    <CartProvider>
      <AdminToolbar />
      <LocalBusinessJsonLd />
      <Header orderingAvailable={orderingAvailable} />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "var(--card)",
            border: "1px solid var(--color-brand-brown)",
            color: "var(--color-brand-cream)",
          },
        }}
      />
    </CartProvider>
  );
}
