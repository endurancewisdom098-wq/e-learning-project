 import mongoose, { Schema, Document } from "mongoose";

export interface IPlan extends Document {
  name: string;
  price: string;
  numericPrice: number;
  duration: string;
  popular: boolean;
  description: string;
  features: string[];
  isActive: boolean;
  stripePriceId?: string;
}

const PlanSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true },
    price: { type: String, required: true },
    numericPrice: { type: Number, required: true },
    duration: { type: String, default: "/month" },
    popular: { type: Boolean, default: false },
    description: { type: String, required: true },
    features: [{ type: String, required: true }],
    isActive: { type: Boolean, default: true },
    stripePriceId: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Plan || mongoose.model<IPlan>("Plan", PlanSchema);