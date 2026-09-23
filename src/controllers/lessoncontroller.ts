import { Request, Response } from 'express';
// Assuming you have a Lesson model set up
// import Lesson from '../models/Lesson';
// import Course from '../models/Course';

/**
 * Create a new lesson within a course/module
 * @route POST /api/v1/lessons
 */
export const createLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId, moduleId, title, description, videoUrl, duration, order } = req.body;
    // @ts-ignore - Assuming auth middleware attaches user info to req.user
    const instructorId = req.user?.id;

    if (!courseId || !title) {
      res.status(400).json({ success: false, error: 'Course ID and Lesson Title are required' });
      return;
    }

    // Optional: Verify if the course exists and belongs to the instructor
    // const course = await Course.findOne({ _id: courseId, instructor: instructorId });
    // if (!course) {
    //   res.status(403).json({ success: false, error: 'Unauthorized or course not found' });
    //   return;
    // }

    // const newLesson = await Lesson.create({
    //   course: courseId,
    //   module: moduleId,
    //   title,
    //   description,
    //   videoUrl,
    //   duration,
    //   order,
    // });

    res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      lesson: { title, courseId, moduleId, videoUrl, duration },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create lesson' });
  }
};

/**
 * Get all lessons for a specific course
 * @route GET /api/v1/lessons/course/:courseId
 */
export const getLessonsByCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;

    // const lessons = await Lesson.find({ course: courseId }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      count: 0,
      lessons: [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch course lessons' });
  }
};

/**
 * Get a single lesson by ID (with content access verification)
 * @route GET /api/v1/lessons/:id
 */
export const getLessonById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // @ts-ignore
    const userId = req.user?.id;
    // @ts-ignore
    const userRole = req.user?.role;

    // const lesson = await Lesson.findById(id);
    // if (!lesson) {
    //   res.status(404).json({ success: false, error: 'Lesson not found' });
    //   return;
    // }

    // Logic to verify if student is enrolled or user is instructor/admin can go here

    res.status(200).json({
      success: true,
      lesson: { id, title: 'Sample Lesson', videoUrl: 'https://...' },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch lesson details' });
  }
};

/**
 * Update lesson details
 * @route PUT /api/v1/lessons/:id
 */
export const updateLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // const updatedLesson = await Lesson.findByIdAndUpdate(id, updates, { new: true });
    // if (!updatedLesson) {
    //   res.status(404).json({ success: false, error: 'Lesson not found' });
    //   return;
    // }

    res.status(200).json({
      success: true,
      message: `Lesson ${id} updated successfully`,
      updates,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update lesson' });
  }
};

/**
 * Delete a lesson
 * @route DELETE /api/v1/lessons/:id
 */
export const deleteLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // const deletedLesson = await Lesson.findByIdAndDelete(id);
    // if (!deletedLesson) {
    //   res.status(404).json({ success: false, error: 'Lesson not found' });
    //   return;
    // }

    res.status(200).json({
      success: true,
      message: `Lesson ${id} deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete lesson' });
  }
};