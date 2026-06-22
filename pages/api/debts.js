import dbConnect from './db';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'lab_inventory_secret_key_asmaa_2024';

const DebtSchema = new mongoose.Schema({
  old: Number,
  newOrder: Number,
  payment: Number,
  remaining: Number,
  monthlyRate: Number,
  monthsLeft: Number,
  date: { type: Date, default: Date.now }
});

const Debt = mongoose.models.Debt || mongoose.model('Debt', DebtSchema);

function authMiddleware(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return false;
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  await dbConnect();

  if (!authMiddleware(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const debts = await Debt.find().sort({ date: -1 });
    return res.json(debts);
  }

  if (req.method === 'POST') {
    const debt = new Debt(req.body);
    await debt.save();
    return res.json(debt);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
