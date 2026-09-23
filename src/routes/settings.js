 const express = require("express");
const router = express.Router();

// In-memory store (Replace with a MongoDB model if desired)
let currentSettings = {
  general: {
    siteName: "LearnHub Platform",
    supportEmail: "support@learnhub.com",
    systemTimezone: "UTC",
    currency: "USD ($)",
    maintenanceMode: false,
  },
  security: {
    enforce2FA: true,
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    allowPublicRegistrations: true,
  },
  notifications: {
    emailNotifications: true,
    courseApprovalAlerts: true,
    financialReportsWeekly: false,
    systemErrorAlerts: true,
  },
  payouts: {
    platformFeePercentage: 15,
    minimumPayoutThreshold: 100,
    payoutSchedule: "monthly",
    stripeConnected: true,
  },
};

// GET /api/admin/settings
router.get("/", (req, res) => {
  try {
    return res.status(200).json({ settings: currentSettings });
  } catch (error) {
    console.error("Fetch settings error:", error);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// PUT /api/admin/settings
router.put("/", (req, res) => {
  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Invalid payload provided" });
    }

    currentSettings = {
      general: { ...currentSettings.general, ...body.general },
      security: { ...currentSettings.security, ...body.security },
      notifications: { ...currentSettings.notifications, ...body.notifications },
      payouts: { ...currentSettings.payouts, ...body.payouts },
    };

    return res.status(200).json({
      message: "System settings updated successfully.",
      settings: currentSettings,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return res.status(500).json({ error: "Failed to update settings" });
  }
});

module.exports = router;