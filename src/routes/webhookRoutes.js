 import express from "express";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// MUST USE express.raw({ type: 'application/json' }) on this endpoint
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`Webhook Signature Verification Failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle session completion event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { planId, userId } = session.metadata;
        const subscriptionId = session.subscription;
        const customerId = session.customer;

        // TODO: Update user status in MongoDB (e.g., User.findByIdAndUpdate(userId, { isSubscribed: true, subscriptionId }))
        console.log(`User ${userId} successfully subscribed to Plan ${planId}`);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        // TODO: Handle subscription cancellation
        console.log(`Subscription ${subscription.id} cancelled`);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  }
);

export default router;