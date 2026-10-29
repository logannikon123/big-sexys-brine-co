import { Container } from "@/components/layout/Container";
import { getClassInfo } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, BookOpen, Clock, Users, DollarSign } from "lucide-react";
import { RichTextContent } from "@/components/ui/rich-text-content";
import Link from "next/link";
import { CourseJsonLd } from "@/components/seo/JsonLd";
import { UPCOMING_CLASSES_ID, UpcomingClasses } from "@/components/classes/UpcomingClasses";
import { getUpcomingClassSessions } from "@/lib/classes/sessions";
import type { Metadata } from "next";

// Build the page on every visit so the seats left are always current.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Take a Class",
  description:
    "Learn the art of brining hands-on with Big Sexy himself. 4-hour workshop, $125 per person, all skill levels welcome. Wheat Ridge, CO.",
  openGraph: {
    title: "Take a Class | Big Sexy's Brine Co.",
    description: "Learn the art of brining hands-on with Big Sexy. 4-hour workshop, $125/person. All skill levels.",
    images: [{ url: "/images/logo/logo-transparent.png" }],
  },
};

export default async function LearnToPreservePage() {
  const [classInfo, sessions] = await Promise.all([getClassInfo(), getUpcomingClassSessions()]);
  const hasSessions = (sessions?.length ?? 0) > 0;

  return (
    <>
    <CourseJsonLd />
    <section className="pt-28 pb-24">
      <Container>
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge className="bg-brand-green/10 text-brand-green border-brand-green/20 mb-4">
            Hands-On Workshop
          </Badge>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-brand-cream">
            {classInfo.title}
          </h1>
          <div className="mt-4">
            <RichTextContent html={classInfo.description} className="prose-p:text-brand-cream/60 prose-p:text-lg" />
          </div>
        </div>

        {/* Key Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            {
              icon: DollarSign,
              label: "Price",
              value: `$${classInfo.price}`,
            },
            {
              icon: Clock,
              label: "Duration",
              value: classInfo.duration,
            },
            {
              icon: Users,
              label: "Class Size",
              value: `Max ${classInfo.maxStudents}`,
            },
            {
              icon: BookOpen,
              label: "Level",
              value: "All Levels",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-card border border-brand-brown/20 rounded-xl p-6 text-center space-y-2"
            >
              <item.icon size={28} className="mx-auto text-brand-orange" />
              <p className="text-sm text-brand-cream/50">{item.label}</p>
              <p className="font-display text-xl font-bold text-brand-cream">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <UpcomingClasses sessions={sessions} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* What You'll Learn */}
          <div className="bg-card border border-brand-brown/20 rounded-xl p-8">
            <h2 className="font-display text-2xl font-bold text-brand-cream mb-6">
              What You&apos;ll Learn
            </h2>
            <ul className="space-y-3">
              {classInfo.whatYouLearn.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check
                    size={20}
                    className="text-brand-green mt-0.5 shrink-0"
                  />
                  <span className="text-brand-cream/70">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What You'll Get */}
          <div className="bg-card border border-brand-brown/20 rounded-xl p-8">
            <h2 className="font-display text-2xl font-bold text-brand-cream mb-6">
              What You&apos;ll Get
            </h2>
            <ul className="space-y-3">
              {classInfo.whatYouGet.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check
                    size={20}
                    className="text-brand-orange mt-0.5 shrink-0"
                  />
                  <span className="text-brand-cream/70">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="bg-brand-brown/20 my-16" />

        {/* Booking CTA */}
        <div className="bg-gradient-to-br from-brand-orange/10 to-brand-gold/10 border border-brand-orange/20 rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-brand-cream mb-4">
            Ready to Learn the Art of the Brine?
          </h2>
          <p className="text-brand-cream/60 text-lg mb-8 max-w-xl mx-auto">
            Only {classInfo.maxStudents} spots per class: small enough that you
            actually learn something, big enough to have a good time doing it.
          </p>
          <Link
            href={hasSessions ? `#${UPCOMING_CLASSES_ID}` : "/contact?subject=class"}
            className="inline-flex items-center px-8 py-4 bg-brand-orange text-white text-lg font-semibold rounded-full hover:bg-brand-orange/90 transition-colors"
          >
            {hasSessions ? "Book Your Spot" : "Ask About the Next Class"}
          </Link>
          <p className="mt-4 text-sm text-brand-cream/40">
            Questions before you commit? Hit us at bigsexysbrineco@gmail.com
          </p>
        </div>
      </Container>
    </section>
    </>
  );
}
