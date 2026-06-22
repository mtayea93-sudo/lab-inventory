import dbConnect from './db';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'lab_inventory_secret_key_asmaa_2024';

const ItemSchema = new mongoose.Schema({
  name: String,
  unit: String,
  price: Number,
  stock: Number
});

const Item = mongoose.models.Item || mongoose.model('Item', ItemSchema);

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
    const items = await Item.find();
    return res.json(items);
  }

  if (req.method === 'POST') {
    const item = new Item(req.body);
    await item.save();
    return res.json(item);
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    const item = await Item.findByIdAndUpdate(id, req.body, { new: true });
    return res.json(item);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    await Item.findByIdAndDelete(id);
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
