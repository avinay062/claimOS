const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateTokens, verifyRefreshToken } = require('../services/tokenService');
const { protect } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });
    const user = await User.create({ name, email, password });
    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push({ token: refreshToken });
    await user.save();
    res.status(201).json({ accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user.isActive) return res.status(403).json({ message: 'Account disabled' });
    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push({ token: refreshToken });
    if (user.refreshTokens.length > 5) user.refreshTokens.shift();
    await user.save();
    res.json({ accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokens.find(t => t.token === refreshToken)) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    const tokens = generateTokens(user._id);
    user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
    user.refreshTokens.push({ token: tokens.refreshToken });
    await user.save();
    res.json(tokens);
  } catch (err) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', protect, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    req.user.refreshTokens = req.user.refreshTokens?.filter(t => t.token !== refreshToken) || [];
    await User.findByIdAndUpdate(req.user._id, { refreshTokens: req.user.refreshTokens });
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Me
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
