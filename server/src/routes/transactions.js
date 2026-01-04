import express from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

const router = express.Router();

const createSchema = z.object({
  type: z.enum(["deposit", "withdrawal", "transfer"]),
  amount: z.number().positive(),
  receiverEmail: z.string().email().optional(), // for transfer
  note: z.string().max(200).optional().default(""),
});

router.post("/", requireAuth, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const data = createSchema.parse(req.body);
    const amount = Math.round(data.amount * 100) / 100;
    if (amount <= 0) return res.status(400).json({ message: "Amount must be positive" });

    let tx;

    await session.withTransaction(async () => {
      const actor = await User.findById(req.user._id).session(session);
      if (!actor) throw Object.assign(new Error("User not found"), { statusCode: 404 });
      if (actor.isFrozen) throw Object.assign(new Error("Account is frozen"), { statusCode: 403 });

      if (data.type === "deposit") {
        actor.balance = Math.round((actor.balance + amount) * 100) / 100;
        await actor.save({ session });
        tx = await Transaction.create(
          [
            {
              type: "deposit",
              senderId: null,
              receiverId: actor._id,
              amount,
              status: "approved",
              note: data.note ?? "",
            },
          ],
          { session }
        );
        return;
      }

      if (data.type === "withdrawal") {
        if (actor.balance < amount) throw Object.assign(new Error("Insufficient funds"), { statusCode: 400 });
        actor.balance = Math.round((actor.balance - amount) * 100) / 100;
        await actor.save({ session });
        tx = await Transaction.create(
          [
            {
              type: "withdrawal",
              senderId: actor._id,
              receiverId: null,
              amount,
              status: "approved",
              note: data.note ?? "",
            },
          ],
          { session }
        );
        return;
      }

      // transfer
      if (!data.receiverEmail) throw Object.assign(new Error("receiverEmail is required"), { statusCode: 400 });
      const receiver = await User.findOne({ email: data.receiverEmail.toLowerCase().trim() }).session(session);
      if (!receiver) throw Object.assign(new Error("Receiver not found"), { statusCode: 404 });
      if (receiver._id.equals(actor._id)) throw Object.assign(new Error("Cannot transfer to yourself"), { statusCode: 400 });
      if (receiver.isFrozen) throw Object.assign(new Error("Receiver account is frozen"), { statusCode: 400 });

      if (actor.balance < amount) throw Object.assign(new Error("Insufficient funds"), { statusCode: 400 });

      const requiresApproval = amount >= env.APPROVAL_THRESHOLD;
      const status = requiresApproval ? "pending" : "approved";

      // If pending, only record transaction; do not move money yet
      if (status === "pending") {
        tx = await Transaction.create(
          [
            {
              type: "transfer",
              senderId: actor._id,
              receiverId: receiver._id,
              amount,
              status: "pending",
              note: data.note ?? "",
            },
          ],
          { session }
        );
        return;
      }

      actor.balance = Math.round((actor.balance - amount) * 100) / 100;
      receiver.balance = Math.round((receiver.balance + amount) * 100) / 100;
      await actor.save({ session });
      await receiver.save({ session });
      tx = await Transaction.create(
        [
          {
            type: "transfer",
            senderId: actor._id,
            receiverId: receiver._id,
            amount,
            status: "approved",
            note: data.note ?? "",
          },
        ],
        { session }
      );
    });

    return res.status(201).json({ transaction: tx?.[0] ?? null });
  } catch (err) {
    return next(err);
  } finally {
    session.endSession();
  }
});

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user._id;
  const transactions = await Transaction.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("senderId", "email name")
    .populate("receiverId", "email name");

  return res.json({ transactions });
});

router.get("/all", requireAuth, requireAdmin, async (req, res) => {
  const transactions = await Transaction.find()
    .sort({ createdAt: -1 })
    .limit(500)
    .populate("senderId", "email name")
    .populate("receiverId", "email name");
  return res.json({ transactions });
});

const decideSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const data = decideSchema.parse(req.body);
    let updated;

    await session.withTransaction(async () => {
      const tx = await Transaction.findById(req.params.id).session(session);
      if (!tx) throw Object.assign(new Error("Transaction not found"), { statusCode: 404 });
      if (tx.status !== "pending") throw Object.assign(new Error("Only pending transactions can be updated"), { statusCode: 400 });
      if (tx.type !== "transfer") throw Object.assign(new Error("Only transfers require approval"), { statusCode: 400 });

      if (data.action === "reject") {
        tx.status = "rejected";
        updated = await tx.save({ session });
        return;
      }

      // approve: move money now
      const sender = await User.findById(tx.senderId).session(session);
      const receiver = await User.findById(tx.receiverId).session(session);
      if (!sender || !receiver) throw Object.assign(new Error("User not found"), { statusCode: 404 });
      if (sender.isFrozen) throw Object.assign(new Error("Sender account is frozen"), { statusCode: 400 });
      if (receiver.isFrozen) throw Object.assign(new Error("Receiver account is frozen"), { statusCode: 400 });
      if (sender.balance < tx.amount) throw Object.assign(new Error("Sender has insufficient funds"), { statusCode: 400 });

      sender.balance = Math.round((sender.balance - tx.amount) * 100) / 100;
      receiver.balance = Math.round((receiver.balance + tx.amount) * 100) / 100;
      await sender.save({ session });
      await receiver.save({ session });

      tx.status = "approved";
      updated = await tx.save({ session });
    });

    return res.json({ transaction: updated });
  } catch (err) {
    return next(err);
  } finally {
    session.endSession();
  }
});

export default router;

