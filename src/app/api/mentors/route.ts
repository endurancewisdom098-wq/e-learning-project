 import { NextResponse } from "next/server";

export interface Mentor {
  id: number;
  name: string;
  role: string;
  image: string;
  students: string;
  courses: number;
  rating: number;
}

const MENTORS_DATA: Mentor[] = [
  {
    id: 1,
    name: "John Anderson",
    role: "Full Stack Developer",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500",
    students: "12,000+",
    courses: 24,
    rating: 4.9,
  },
  {
    id: 2,
    name: "Sarah Johnson",
    role: "UI/UX Designer",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500",
    students: "9,500+",
    courses: 18,
    rating: 4.8,
  },
  {
    id: 3,
    name: "Michael Brown",
    role: "Data Scientist",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500",
    students: "15,000+",
    courses: 32,
    rating: 5.0,
  },
  {
    id: 4,
    name: "Emily Davis",
    role: "Digital Marketing Expert",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500",
    students: "8,000+",
    courses: 15,
    rating: 4.9,
  },
];

export async function GET() {
  // Simulate network latency or database query delay
  return NextResponse.json(MENTORS_DATA, { status: 200 });
}