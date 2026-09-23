 const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken"); // Or your token generation strategy

const router = express.Router();

// 1. Initial Google Login Trigger (Called by your frontend button)
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// 2. Google OAuth Callback (Google sends user back here)
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/auth/login?error=GoogleAuthFailed`,
  }),
  (req, res) => {
    // Generate JWT token for the user
    const token = jwt.sign(
      { userId: req.user._id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Send token via HTTP-only cookie OR query string redirect
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    // Redirect user back to Next.js frontend dashboard
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

module.exports = router;