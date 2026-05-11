import { getUncachableStripeClient } from './stripeClient.js';

/**
 * Seeds Convoy subscription products in Stripe (idempotent).
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seed-convoy-products.ts
 */
async function seedConvoyProducts() {
  const stripe = await getUncachableStripeClient();
  console.log('Checking existing Convoy products in Stripe...');

  const plans = [
    {
      name: 'Convoy Convenience',
      description: 'Convoys up to 9 vehicles',
      tier: 'convenience',
      unitAmount: 399, // £3.99
      currency: 'gbp',
    },
    {
      name: 'Convoy Roadtrip',
      description: 'Unlimited vehicles + priority support',
      tier: 'roadtrip',
      unitAmount: 699, // £6.99
      currency: 'gbp',
    },
  ];

  for (const plan of plans) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`✓ ${plan.name} already exists (${existing.data[0].id})`);
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { tier: plan.tier, app: 'convoy' },
    });
    console.log(`Created product: ${product.name} (${product.id})`);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.unitAmount,
      currency: plan.currency,
      recurring: { interval: 'month' },
    });
    console.log(`  Price: £${(plan.unitAmount / 100).toFixed(2)}/month (${price.id})`);
  }

  console.log('\nDone. Webhooks will sync data to the database automatically.');
}

seedConvoyProducts().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
