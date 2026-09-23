 import express from "express";
import Stripe from "stripe";
import Plan from "../models/Plan.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * @route   POST /api/checkout
 * @desc    Create Stripe Subscription Checkout Session
 * @access  Public (or Protected with Auth Middleware)
 */
router.post("/checkout", async (req, res) => {
  try {
    const { planId, customerEmail, userId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID is required.",
      });
    }

    // 1. Fetch plan details from MongoDB
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Requested plan was not found or is inactive.",
      });
    }

    // 2. Build line items (uses existing Stripe Price ID if available, or constructs price dynamically)
    const lineItems = plan.stripePriceId
      ? [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ]
      : [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${plan.name} Subscription Plan`,
                description: plan.description,
              },
              unit_amount: Math.round(plan.numericPrice * 100), // Convert dollars to cents
              recurring: {
                interval: plan.duration.includes("year") ? "year" : "month",
              },
            },
            quantity: 1,
          },
        ];

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: customerEmail || undefined,
      line_items: lineItems,
      metadata: {
        planId: plan._id.toString(),
        planName: plan.name,
        userId: userId || "guest",
      },
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
    });

    // 4. Return session checkout URL to frontend
    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Stripe Checkout Session Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create checkout session.",
    });
  }
});

export default router;