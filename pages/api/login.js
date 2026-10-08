import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const ADMIN_PASSWORD_HASH = '$2b$10$v9quhMgI3IYzng4UaLidGOZdxqJ5K.aNwmQ7RnDoF2fgYVzcTDZqS'; // mhmd@1993
const JWT_SECRET = 'lab_inventory_secret_key_asmaa_2024';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;
  const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
}
