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
    // Prefer the stored Stripe customer id to avoid a potentially ambiguous
    // email-based lookup (a member could share an email across test/live modes).
    let customerId: string | null = null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      // Fall back to the email-based lookup for members who checked out before
      // the stripe_customer_id column was added.
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = customers.data[0]?.id ?? null;
    }

    if (!customerId) {
      return NextResponse.redirect(new URL("/account", siteUrl));
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/account`,
    });
    return NextResponse.redirect(session.url);
  } catch (err) {
    console.error("billing portal error", err);
    return NextResponse.redirect(new URL("/account", siteUrl));
  }
}
