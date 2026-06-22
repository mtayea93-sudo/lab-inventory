import dbConnect from './db';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'lab_inventory_secret_key_asmaa_2024';

const OrderSchema = new mongoose.Schema({
  itemId: String,
  quantity: Number,
  total: Number
});

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);

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
    const orders = await Order.find();
    return res.json(orders);
  }

  if (req.method === 'POST') {
    await Order.findOneAndUpdate(
      { itemId: req.body.itemId }, req.body, { upsert: true, new: true }
    );
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
