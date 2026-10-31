import "server-only";

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

/**
 * Tell the customer their order status changed, through Resend
 * (https://resend.com). Optional: without RESEND_API_KEY nothing is sent.
 * Never throws, so an email problem can't undo or block an order change.
 */
export async function sendOrderStatusEmail(order: OrderForEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !order.buyer_email) return;

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

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [order.buyer_email],
        subject: `Order #${order.id}: ${status}`,
        text: lines.join("\n"),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("[email] Resend returned", response.status, await response.text());
    }
  } catch (error) {
    console.error("[email] could not send order email", error);
  }
}
