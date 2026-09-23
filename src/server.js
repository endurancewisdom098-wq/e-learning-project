// // server.js
// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const cookieParser = require("cookie-parser");
// const passport = require("passport");

// require("dotenv").config();
// // 📌 Place environment check right here
// if (!process.env.MONGO_URI) {
//   console.error("Missing MONGO_URI in environment variables.");
// }

// // Load Passport Configuration
// require("./config/passport");

// // Import Routes
// const authRoutes = require("./routes/auth");
// const pricingRoutes = require("./routes/pricingRoutes");
// const checkoutRoutes = require("./routes/checkoutRoutes");
// const webhookRoutes = require("./routes/webhookRoutes");

// const app = express();

// const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/learnhub";
// const PORT = process.env.PORT || 5000;

// // CORS Configuration
// const allowedOrigins = [
//   "http://localhost:3000",
//   process.env.FRONTEND_URL,
// ].filter(Boolean);

// app.use(
//   cors({
//     origin: allowedOrigins,
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

// // Stripe webhook route (must come before express.json)
// app.use("/api", webhookRoutes);

// // Body parsing middleware
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());

// // Passport
// app.use(passport.initialize());

// // API Routes
// app.use("/api/auth", authRoutes);
// app.use("/api", pricingRoutes);
// app.use("/api", checkoutRoutes);

// // Inline Mock Login Fallback
// app.post("/api/auth/login", (req, res) => {
//   const { email, password } = req.body;
//   if (!email || !password) {
//     return res.status(400).json({ success: false, message: "Email and password required." });
//   }
//   if (email === "test@example.com" && password === "password123") {
//     return res.status(200).json({
//       success: true,
//       token: "your_jwt_token_here",
//       user: { id: "1", name: "Test User", email, role: "student" },
//     });
//   }
//   return res.status(401).json({ success: false, message: "Invalid credentials." });
// });

// // Health Check
// app.get("/", (req, res) => {
//   res.status(200).json({ message: "LearnHub API Server is running" });
// });

// // Global Error Handler
// app.use((err, req, res, next) => {
//   console.error("Unhandled Error:", err.stack);
//   res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
// });

// // 📌 PLACE `startServer` HERE AT THE VERY BOTTOM OF `server.js`
// async function startServer() {
//   try {
//     await mongoose.connect(MONGO_URI);
//     console.log("MongoDB Connected Successfully");
//     app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
//   } catch (err) {
//     console.error("Failed to connect to MongoDB:", err.message);
//     process.exit(1);
//   }
// }

// startServer();