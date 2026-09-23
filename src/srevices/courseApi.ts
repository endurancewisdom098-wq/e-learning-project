 import axios from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface Lesson {
  id: number;
  title: string;
  videoUrl: string;
  duration?: number;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  thumbnail?: string;
  lessons: Lesson[];
}

export const getCourses = async (): Promise<Course[]> => {
  const response = await axios.get(`${API_URL}/api/courses`);

  return response.data;
};

export const getCourse = async (courseId: number): Promise<Course> => {
  const response = await axios.get(
    `${API_URL}/api/courses/${courseId}`
  );

  return response.data;
};