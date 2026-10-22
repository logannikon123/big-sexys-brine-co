import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { alertOwnerLater, errorMessage } from "@/lib/alerts";

/** A contact message wasn't sent, and it isn't stored anywhere else. */
function alertLost(reason: string) {
  alertOwnerLater({
    key: "forms:email-failed",
    title: "A contact form message was lost",
    message: `Someone sent the contact form, but the email didn't go out (${reason}). They were told it failed and may try again.`,
  });
}

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(254),
  subject: z.string().min(2).max(200),
  message: z.string().min(10).max(5000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = contactSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, subject, message } = result.data;

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        const toEmail = process.env.CONTACT_EMAIL || "bigsexysbrineco@gmail.com";
        console.log(`Sending contact form email to: ${toEmail}`);

        const emailResult = await resend.emails.send({
          from: "Big Sexy's Brine Co. <noreply@bigsexysbrine.co>",
          to: toEmail,
          subject: `[Website] ${subject} - from ${name}`,
          text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
          replyTo: email,
        });

        // Resend reports a refused email in `error` instead of throwing.
        if (emailResult.error) {
          console.error("Resend did not send the contact email:", emailResult.error);
          alertLost(`Resend refused it: ${emailResult.error.message}`);
          return NextResponse.json(
            { error: "Failed to send message" },
            { status: 500 }
          );
        }

        console.log("Contact email sent:", emailResult.data?.id);
      } catch (emailError) {
        console.error("Failed to send contact email via Resend:", emailError);
        alertLost(errorMessage(emailError));
        return NextResponse.json(
          { error: "Failed to send message" },
          { status: 500 }
        );
      }
    } else {
      // Contact messages aren't stored anywhere else, so without email they'd be lost.
      console.error("Contact form: RESEND_API_KEY is not set, so the message was not sent.");
      alertLost("RESEND_API_KEY is not set");
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
