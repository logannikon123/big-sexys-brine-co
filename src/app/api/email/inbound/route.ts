import { NextRequest, NextResponse } from "next/server";

/**
 * Resend Inbound Webhook
 * 
 * When someone sends an email to *@bigsexysbrine.co, Resend receives it
 * and sends a POST request to this endpoint with the email data.
 * We then forward the email to the Gmail inbox using Resend's sending API.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Resend inbound webhook payload structure
    const {
      from: senderAddress,
      to: recipientAddresses,
      subject,
      text,
      html,
    } = payload;

    // Extract sender info
    const fromEmail = typeof senderAddress === "string" 
      ? senderAddress 
      : senderAddress?.address || senderAddress?.email || "unknown@unknown.com";
    
    const fromName = typeof senderAddress === "object" 
      ? senderAddress?.name || fromEmail 
      : fromEmail;

    // The destination Gmail address
    const forwardTo = process.env.CONTACT_EMAIL || "bigsexysbrineco@gmail.com";

    // Build the forwarded subject
    const forwardedSubject = `[Fwd] ${subject || "(no subject)"}`;

    // Build forwarded body with original sender info
    const forwardedText = [
      `--- Forwarded email from ${fromName} <${fromEmail}> ---`,
      `To: ${Array.isArray(recipientAddresses) ? recipientAddresses.join(", ") : recipientAddresses}`,
      `Subject: ${subject || "(no subject)"}`,
      `---`,
      ``,
      text || "(no text content)",
    ].join("\n");

    const forwardedHtml = html
      ? `<div style="padding:12px;margin-bottom:16px;border-left:4px solid #22c55e;background:#f0fdf4;">
          <strong>Forwarded email</strong><br/>
          From: ${fromName} &lt;${fromEmail}&gt;<br/>
          To: ${Array.isArray(recipientAddresses) ? recipientAddresses.join(", ") : recipientAddresses}<br/>
          Subject: ${subject || "(no subject)"}
        </div>
        ${html}`
      : undefined;

    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: `Big Sexy's Brine Co. <noreply@bigsexysbrine.co>`,
        to: forwardTo,
        subject: forwardedSubject,
        text: forwardedText,
        html: forwardedHtml,
        replyTo: fromEmail,
      });

      console.log(`Forwarded email from ${fromEmail} to ${forwardTo}: ${subject}`);
    } else {
      console.log("Inbound email received (no RESEND_API_KEY):", {
        from: fromEmail,
        subject,
      });
    }

    // Resend expects a 200 response to acknowledge receipt
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Inbound email webhook error:", error);
    // Still return 200 to prevent Resend from retrying
    return NextResponse.json({ success: true });
  }
}
