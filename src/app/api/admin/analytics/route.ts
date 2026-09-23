 import { NextResponse } from "next/server";

export interface AnalyticsMetric {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  subtext: string;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  expenses: number;
}

export interface CategoryDistribution {
  category: string;
  percentage: number;
  students: number;
  color: string;
}

export interface TopCourse {
  id: string;
  title: string;
  instructor: string;
  students: number;
  revenue: string;
  rating: number;
}

export interface AnalyticsResponse {
  metrics: AnalyticsMetric[];
  monthlyRevenue: MonthlyRevenue[];
  categoryDistribution: CategoryDistribution[];
  topCourses: TopCourse[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get("timeframe") || "30d";

  // Mock database queries based on timeframe multiplier
  const multiplier = timeframe === "7d" ? 0.3 : timeframe === "90d" ? 2.5 : 1;

  const data: AnalyticsResponse = {
    metrics: [
      {
        title: "Total Platform Revenue",
        value: `$${(128450 * multiplier).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        change: "+14.2%",
        isPositive: true,
        subtext: "vs. previous period",
      },
      {
        title: "Active Students",
        value: Math.round(14230 * (timeframe === "7d" ? 0.9 : 1)).toLocaleString(),
        change: "+8.1%",
        isPositive: true,
        subtext: "active in last 30 days",
      },
      {
        title: "Course Completion Rate",
        value: "68.4%",
        change: "-1.5%",
        isPositive: false,
        subtext: "across all active tracks",
      },
      {
        title: "New Instructors Onboarded",
        value: Math.round(48 * multiplier).toString(),
        change: "+22.0%",
        isPositive: true,
        subtext: "verified application profiles",
      },
    ],
    monthlyRevenue: [
      { month: "Jan", revenue: 18400, expenses: 6200 },
      { month: "Feb", revenue: 22100, expenses: 7100 },
      { month: "Mar", revenue: 26800, expenses: 8400 },
      { month: "Apr", revenue: 24200, expenses: 7900 },
      { month: "May", revenue: 31500, expenses: 9800 },
      { month: "Jun", revenue: 38900, expenses: 11200 },
      { month: "Jul", revenue: 42100, expenses: 12500 },
    ],
    categoryDistribution: [
      { category: "Web Development", percentage: 42, students: 5976, color: "bg-indigo-500" },
      { category: "Data Science & AI", percentage: 28, students: 3984, color: "bg-purple-500" },
      { category: "UI/UX Design", percentage: 18, students: 2561, color: "bg-cyan-500" },
      { category: "Cloud & DevOps", percentage: 12, students: 1707, color: "bg-emerald-500" },
    ],
    topCourses: [
      {
        id: "c-101",
        title: "Fullstack Next.js & TypeScript Masterclass",
        instructor: "Sarah Drasner",
        students: 3420,
        revenue: "$41,040",
        rating: 4.9,
      },
      {
        id: "c-102",
        title: "Advanced Tailwind CSS & Design Systems",
        instructor: "Adam Wathan",
        students: 2890,
        revenue: "$28,900",
        rating: 4.8,
      },
      {
        id: "c-103",
        title: "AI & Machine Learning with Python",
        instructor: "Andrew Ng",
        students: 2410,
        revenue: "$36,150",
        rating: 4.9,
      },
      {
        id: "c-104",
        title: "System Design for Senior Engineers",
        instructor: "Alex Xu",
        students: 1980,
        revenue: "$29,700",
        rating: 4.7,
      },
    ],
  };

  return NextResponse.json(data);
}