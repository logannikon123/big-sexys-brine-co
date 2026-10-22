import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { alertOwnerLater, errorMessage } from "@/lib/alerts";
import { createServiceClient } from "@/lib/supabase/server";
import { consentContext, recordMarketingOptIn } from "@/lib/marketing-server";

/** The contest entry is saved, but its email didn't go out. */
function alertEmailFailed(reason: string) {
  alertOwnerLater({
    key: "forms:email-failed",
    title: "A contest entry email failed",
    message: `A pickle pun contest entry was saved, but its email didn't go out (${reason}). The entry is in the contest_entries table in Supabase.`,
  });
}

const contestSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(254),
  pun: z.string().min(5).max(1000),
  /** True when the visitor ticked the marketing email box (it starts ticked). */
  marketingOptIn: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = contestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, pun, marketingOptIn } = result.data;

    // Always save to Supabase first so entries are never lost
    const supabase = await createServiceClient();
    const { data: entry, error: dbError } = await supabase
      .from("contest_entries")
      .insert({ name, email, pun })
      .select("id")
      .single();

    if (dbError) {
      console.error("Failed to save contest entry to database:", dbError);
      alertOwnerLater({
        key: "forms:save-failed",
        title: "A contest entry couldn't be saved",
        message: `Someone entered the pickle pun contest, but the entry couldn't be saved (${dbError.message}). They were told it failed and may try again.`,
      });
      // Without a saved entry there's no record of it, so ask the visitor to try again.
      return NextResponse.json(
        { error: "Failed to submit entry" },
        { status: 500 }
      );
    }

    if (marketingOptIn) {
      await recordMarketingOptIn({
        email,
        name,
        source: "contest",
        contestEntryId: entry?.id ?? null,
        ...consentContext(request),
      });
    }

    // Then send email notification
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        const toEmail = process.env.CONTACT_EMAIL || "bigsexysbrineco@gmail.com";
        console.log(`Sending contest entry email to: ${toEmail}`);

        const emailResult = await resend.emails.send({
          from: "Big Sexy's Brine Co. <noreply@bigsexysbrine.co>",
          to: toEmail,
          subject: `[Pickle Pun Contest] Entry from ${name}`,
          text: `New pickle pun contest entry!\n\nName: ${name}\nEmail: ${email}\n\nPickle Pun:\n${pun}`,
          replyTo: email,
        });

        // Resend reports a refused email in `error` instead of throwing. The entry
        // is already saved, so the visitor still gets a success message.
        if (emailResult.error) {
          console.error("Resend did not send the contest email:", emailResult.error);
          alertEmailFailed(`Resend refused it: ${emailResult.error.message}`);
        } else {
          console.log("Contest email sent:", emailResult.data?.id);
        }
      } catch (emailError) {
        console.error("Failed to send contest email via Resend:", emailError);
        alertEmailFailed(errorMessage(emailError));
        // Don't fail the request — the entry is already saved in the database
      }
    } else {
      console.warn("Contest form: RESEND_API_KEY is not set, so no email went out. The entry is saved.");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contest form error:", error);
    return NextResponse.json(
      { error: "Failed to submit entry" },
      { status: 500 }
    );
  }
}
