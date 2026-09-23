 import express from "express";
import Plan from "../models/Plan.js";

const router = express.Routes();

// GET: Fetch all active pricing plans
router.get("/plans", async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ numericPrice: 1 });
    return res.status(200).json({ success: true, data: plans });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

// POST: Seed initial plan data (for initial setup)
router.post("/plans/seed", async (req, res) => {
  try {
    await Plan.deleteMany({});
    const initialPlans = [
      {
        name: "Basic",
        price: "$19",
        numericPrice: 19,
        duration: "/month",
        popular: false,
        description: "Essential features for individuals starting out.",
        features: [
          "Access to 50+ Courses",
          "Community Support",
          "Download Resources",
          "Certificate of Completion",
        ],
      },
      {
        name: "Pro",
        price: "$49",
        numericPrice: 49,
        duration: "/month",
        popular: true,
        description: "Perfect for dedicated learners aiming for career growth.",
        features: [
          "Access to All Courses",
          "Live Classes",
          "Expert Mentorship",
          "Career Guidance",
          "Certificates of Completion",
        ],
      },
      {
        name: "Premium",
        price: "$99",
        numericPrice: 99,
        duration: "/month",
        popular: false,
        description: "Complete hands-on experience with dedicated support.",
        features: [
          "Everything in Pro",
          "1-on-1 Mentorship",
          "Job Placement Support",
          "Exclusive Workshops",
          "Priority Support",
        ],
      },
    ];

    const createdPlans = await Plan.insertMany(initialPlans);
    return res.status(201).json({ success: true, data: createdPlans });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default Routes;