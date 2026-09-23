import { Request, Response } from "express";

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // 1. Basic validation
    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: "All required fields must be provided." });
      return;
    }

    // 2. Insert your DB logic here (e.g., Prisma check & hash password)
    // const existingUser = await prisma.user.findUnique({ where: { email } });
    // if (existingUser) return res.status(400).json({ error: "User already exists" });

    // Mock response for successful creation
    const fakeToken = "mock_jwt_token_xyz123";

    res.status(201).json({
      message: "Registration successful",
      token: fakeToken,
      user: {
        firstName,
        lastName,
        email,
        role: role || "STUDENT",
      },
    });
  } catch (error: any) {
    console.error("Register Error:", error);
    res.status(500).json({ error: "Internal server error during registration." });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    // 2. Insert DB Lookup & Password Verification Here
    // const user = await prisma.user.findUnique({ where: { email } });
    // if (!user) return res.status(401).json({ error: "Invalid credentials" });
    // const isMatch = await bcrypt.compare(password, user.password);
    // if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    // Mock Token & User Data
    const fakeToken = "mock_jwt_login_token_abc789";

    res.status(200).json({
      message: "Login successful",
      token: fakeToken,
      user: {
        id: "usr_12345",
        email,
        firstName: "John",
        lastName: "Doe",
        role: "STUDENT",
      },
    });
  } catch (error: any) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal server error during login." });
  }
};