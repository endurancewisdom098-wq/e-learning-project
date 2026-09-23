import { NextResponse } from "next/server";

// Force dynamic rendering to prevent static caching by Next.js
export const dynamic = "force-dynamic";

export interface SystemSettings {
  general: {
    siteName: string;
    supportEmail: string;
    systemTimezone: string;
    currency: string;
    maintenanceMode: boolean;
  };
  security: {
    enforce2FA: boolean;
    sessionTimeoutMinutes: number;
    maxLoginAttempts: number;
    allowPublicRegistrations: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    courseApprovalAlerts: boolean;
    financialReportsWeekly: boolean;
    systemErrorAlerts: boolean;
  };
  payouts: {
    platformFeePercentage: number;
    minimumPayoutThreshold: number;
    payoutSchedule: "weekly" | "biweekly" | "monthly";
    stripeConnected: boolean;
  };
}

// Default in-memory store for LearnHub platform settings
let currentSettings: SystemSettings = {
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

/**
  GET Handler
  Returns the current system settings wrapped in `{ settings: SystemSettings }`
 */
export async function GET() {
  try {
    return NextResponse.json({ settings: currentSettings }, { status: 200 });
  } catch (error) {
    console.error("[SETTINGS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch system settings." },
      { status: 500 }
    );
  }
}

/**
  PUT Handler
  Accepts partial or full SystemSettings payload and merges updates safely
 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Partial<SystemSettings> | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid payload provided. Body must be a JSON object." },
        { status: 400 }
      );
    }

    // Safely deep-merge nested sections without dropping existing keys
    currentSettings = {
      general: {
        ...currentSettings.general,
        ...(body.general || {}),
      },
      security: {
        ...currentSettings.security,
        ...(body.security || {}),
      },
      notifications: {
        ...currentSettings.notifications,
        ...(body.notifications || {}),
      },
      payouts: {
        ...currentSettings.payouts,
        ...(body.payouts || {}),
      },
    };

    return NextResponse.json(
      {
        message: "System settings updated successfully.",
        settings: currentSettings,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[SETTINGS_PUT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update system settings." },
      { status: 500 }
    );
  }
}