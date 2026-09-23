import express, { Request, Response } from "express";

const router = express.Router();

router.post("/convert", (req: Request, res: Response) => {
  try {
    const { amountUsd } = req.body;

    if (amountUsd === undefined || isNaN(amountUsd)) {
      return res.status(400).json({ error: "A valid amount in USD is required" });
    }

    // Exchange rate (you can pull this from an env variable or keep a default)
    const exchangeRate = Number(process.env.USD_NGN_RATE) || 1330.63;
    const amountInNaira = Number(amountUsd) * exchangeRate;

    // Format nicely with commas and currency symbol using your logic
    const formattedNaira = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amountInNaira);

    return res.status(200).json({
      success: true,
      amountUsd: Number(amountUsd),
      exchangeRate,
      formattedNaira,
    });
  } catch (error) {
    console.error("Conversion error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;