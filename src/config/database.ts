import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/elearning_db';

    const conn = await mongoose.connect(mongoUri);

    console.log(`MongoDB Connected Successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Error: ${(error as Error).message}`);
    // Exit process with failure code so the server doesn't run without a DB
    process.exit(1);
  }
};

export default connectDB;