import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["deposit", "withdrawal", "transfer"], required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    amount: { type: Number, required: true, min: 0.01 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

transactionSchema.index({ senderId: 1, createdAt: -1 });
transactionSchema.index({ receiverId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);

