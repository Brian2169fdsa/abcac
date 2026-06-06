import { NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Opens the Stripe billing portal for the signed-in member to manage their
// Certification Sync / annual subscriptions.
export async function GET(req: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!isStripeConfigured) {
    return NextResponse.redirect(new URL("/account", siteUrl));
  }

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.redirect(new URL("/login?next=/account", siteUrl));
  }

  try {
    // Find the Stripe customer by the email used at checkout.
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) {
      return NextResponse.redirect(new URL("/account", siteUrl));
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${siteUrl}/account`,
    });
    return NextResponse.redirect(session.url);
  } catch (err) {
    console.error("billing portal error", err);
    return NextResponse.redirect(new URL("/account", siteUrl));
  }
}
