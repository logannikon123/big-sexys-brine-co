import { Container } from "@/components/layout/Container";
import { HeatIndicator } from "@/components/products/HeatIndicator";
import { getProducts, getProductBySlug, getOrderingAvailable } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { ProductImageCarousel } from "@/components/products/ProductImageCarousel";
import { PriceTag } from "@/components/products/PriceTag";
import { canOrderOnline, sizeLabel } from "@/lib/utils";
import { AddToCart } from "@/components/cart/AddToCart";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { toPlainText } from "@/lib/plain-text";
import { CottageFoodNotice } from "@/components/legal/CottageFoodNotice";

// Revalidate every 60 seconds — ensures revalidatePath() from admin
// actions actually busts the edge cache for these pages.
export const revalidate = 60;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({
    slug: product.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };
  // Search results and link previews show plain text, not formatting.
  const description = toPlainText(product.description, 160);
  return {
    title: product.name,
    description,
    openGraph: {
      title: `${product.name} | Big Sexy's Brine Co.`,
      description,
      images: [{ url: product.image }],
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const [allProducts, orderingAvailable] = await Promise.all([
    getProducts(),
    getOrderingAvailable(),
  ]);
  const orderable = orderingAvailable && canOrderOnline(product);
  const currentIndex = allProducts.findIndex((p) => p.slug === slug);
  const prevProduct = currentIndex > 0 ? allProducts[currentIndex - 1] : null;
  const nextProduct =
    currentIndex < allProducts.length - 1 ? allProducts[currentIndex + 1] : null;

  return (
    <>
      <ProductJsonLd product={product} />
      <BreadcrumbJsonLd items={[
        { name: "Home", href: "/" },
        { name: "Products", href: "/products" },
        { name: product.name, href: `/products/${product.slug}` },
      ]} />
      <section className="pt-28 pb-24">
        <Container>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-brand-cream/60 hover:text-brand-orange transition-colors mb-8"
          >
            <ArrowLeft size={16} />
            Back to the Lineup
          </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image(s) */}
          <ProductImageCarousel
            images={product.images ?? []}
            productName={product.name}
            productSize={sizeLabel(product.size)}
            fallbackImage={product.image}
          />

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <Badge
                variant="outline"
                className="border-brand-green/40 text-brand-green mb-3"
              >
                {product.category}
              </Badge>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-brand-cream">
                {product.name}
              </h1>
              <p className="mt-2 text-xl text-brand-cream/60 italic font-display">
                {product.tagline}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <PriceTag
                priceCents={product.priceCents}
                soldOut={product.soldOut}
                priceClassName="font-display text-3xl font-bold"
              />
              <div className="flex items-center gap-4">
                <span className="text-sm text-brand-cream/60">Heat Level:</span>
                <HeatIndicator level={product.heat} size={20} />
              </div>
            </div>

            <Separator className="bg-brand-brown/30" />

            <div>
              <h2 className="font-display text-xl font-semibold text-brand-cream mb-3">
                The Lowdown
              </h2>
              <RichTextContent html={product.description} />
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-brand-cream mb-3">
                What&apos;s In the Jar
              </h2>
              <div className="flex flex-wrap gap-2">
                {product.ingredients.map((ingredient) => (
                  <Badge
                    key={ingredient}
                    variant="outline"
                    className="border-brand-brown/40 text-brand-cream/70"
                  >
                    {ingredient}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator className="bg-brand-brown/30" />

            <div className="bg-card border border-brand-brown/20 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-display text-lg font-semibold text-brand-cream">
                  {orderable ? "Order This Jar" : "Want This Jar?"}
                </h3>
                <PriceTag
                  priceCents={product.priceCents}
                  soldOut={product.soldOut}
                  priceClassName="text-lg"
                />
              </div>
              {orderable ? (
                <>
                  <AddToCart productId={product.id} productName={product.name} />
                  <p className="text-xs text-brand-cream/60">
                    Pick up in Lakewood, local delivery, or shipping (Colorado only).
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-brand-cream/60">
                    {orderingAvailable ? (
                      "Sold out online for now. Find it at our next market."
                    ) : (
                      <>
                        Grab one at our next market, or reach out for custom orders and
                        bulk pricing. We&apos;ll hook you up.
                      </>
                    )}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href="/contact"
                      className="inline-flex items-center justify-center px-6 py-3 bg-brand-orange text-white font-semibold rounded-full hover:bg-brand-orange/90 transition-colors"
                    >
                      Say Hello
                    </Link>
                    <Link
                      href="/events"
                      className="inline-flex items-center justify-center px-6 py-3 border border-brand-cream/30 text-brand-cream font-semibold rounded-full hover:border-brand-orange hover:text-brand-orange transition-colors"
                    >
                      Find Us Live
                    </Link>
                  </div>
                </>
              )}
              {/* Colorado's cottage food law wants this notice where people buy. */}
              <CottageFoodNotice className="border-t border-brand-brown/20 pt-4" />
            </div>
          </div>
        </div>

        {/* Previous/Next */}
        <div className="flex items-center justify-between mt-16 pt-8 border-t border-brand-brown/20">
          {prevProduct ? (
            <Link
              href={`/products/${prevProduct.slug}`}
              className="flex items-center gap-2 text-brand-cream/60 hover:text-brand-orange transition-colors"
            >
              <ArrowLeft size={16} />
              {prevProduct.name}
            </Link>
          ) : (
            <div />
          )}
          {nextProduct ? (
            <Link
              href={`/products/${nextProduct.slug}`}
              className="flex items-center gap-2 text-brand-cream/60 hover:text-brand-orange transition-colors"
            >
              {nextProduct.name}
              <ArrowRight size={16} />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </Container>
    </section>
    </>
  );
}
