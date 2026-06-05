import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature") ?? "";

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const getPhantomUserId = (obj: { metadata?: Record<string, string> }) =>
    obj.metadata?.phantomUserId ?? null;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub    = event.data.object as Stripe.Subscription;
      const userId = getPhantomUserId(sub);
      if (userId) {
        const plan = (sub.items.data[0]?.price.id === process.env.STRIPE_PRICE_PRO) ? "pro" : "starter";
        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeSubscriptionId: sub.id,
            subscriptionStatus:   sub.status,
            plan,
          },
        }).catch(() => null);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub    = event.data.object as Stripe.Subscription;
      const userId = getPhantomUserId(sub);
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionStatus: "canceled", plan: "free" },
        }).catch(() => null);
      }
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      // Look up user via Stripe customer ID
      const custId = typeof inv.customer === "string" ? inv.customer : (inv.customer as Stripe.Customer | null)?.id ?? null;
      if (custId) {
        await prisma.user.updateMany({
          where: { stripeCustomerId: custId },
          data: { subscriptionStatus: "past_due" },
        }).catch(() => null);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
