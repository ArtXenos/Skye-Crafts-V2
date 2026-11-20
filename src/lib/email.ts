import "server-only";

import { createTransport } from "nodemailer";
import { SITE_URL } from "@/lib/env";
import { formatPeso } from "@/lib/money";
import { customerStatusLabel, SHOP_NAME } from "@/lib/shop";

type OrderForEmail = {
  id: number;
  buyer_email: string;
  status: string;
  fulfillment: string;
  total_cents: number;
  status_note: string;
};

type Message = { to: string; subject: string; text: string };

/**
 * Tell the customer their order status changed. Optional: with no email
 * settings nothing is sent. Never throws, so an email problem can't undo or
 * block an order change.
 */
export async function sendOrderStatusEmail(order: OrderForEmail) {
  if (!order.buyer_email) return;

  const status = customerStatusLabel(order.status, order.fulfillment);
  const lines = [
    `Hi! Here's an update on your ${SHOP_NAME} order #${order.id}.`,
    "",
    `Status: ${status}`,
    order.status_note ? `Note from the shop: ${order.status_note}` : "",
    `Total: ${formatPeso(order.total_cents)}`,
    "",
    `See your order: ${SITE_URL}/account/orders/${order.id}`,
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "");

  await sendEmail({ to: order.buyer_email, subject: `Order #${order.id}: ${status}`, text: lines.join("\n") });
}

/**
 * Send through SMTP when SMTP_HOST is set (for example Gmail with an app
 * password: works without owning a domain), otherwise through Resend when
 * RESEND_API_KEY is set (needs a domain verified in Resend). EMAIL_FROM is
 * required either way.
 */
async function sendEmail(message: Message) {
  const from = process.env.EMAIL_FROM;
  if (!from) return;
  try {
    if (process.env.SMTP_HOST) await sendWithSmtp(from, message);
    else if (process.env.RESEND_API_KEY) await sendWithResend(process.env.RESEND_API_KEY, from, message);
  } catch (error) {
    console.error("[email] could not send email", error);
  }
}

async function sendWithSmtp(from: string, message: Message) {
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465: TLS from the start; 587: upgrades with STARTTLS
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Keep a slow mail server from holding the serverless function open.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  await transport.sendMail({ from, ...message });
}

async function sendWithResend(apiKey: string, from: string, message: Message) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    console.error("[email] Resend returned", response.status, await response.text());
  }
}
