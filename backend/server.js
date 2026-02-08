
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db.js';
import { User, FoodPosting, ChatMessage, Notification } from './models.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images

// Connect to Database
connectDB();

// --- USER ROUTES ---
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { id: req.body.id }, 
      req.body, 
      { upsert: true, new: true }
    );
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { id: req.params.id }, 
      { $set: req.body }, 
      { new: true }
    );
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- POSTING ROUTES ---
app.get('/api/postings', async (req, res) => {
  try {
    const postings = await FoodPosting.find().sort({ createdAt: -1 });
    res.json(postings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/postings', async (req, res) => {
  try {
    const posting = await FoodPosting.findOneAndUpdate(
      { id: req.body.id },
      req.body,
      { upsert: true, new: true }
    );
    res.json(posting);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/postings/:id', async (req, res) => {
  try {
    const posting = await FoodPosting.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    res.json(posting);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/postings/:id', async (req, res) => {
  try {
    await FoodPosting.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RATING ROUTES ---
app.post('/api/ratings', async (req, res) => {
  const { postingId, ratingData } = req.body;
  try {
    // 1. Update Posting
    const posting = await FoodPosting.findOne({ id: postingId });
    if (posting) {
      posting.ratings.push(ratingData);
      await posting.save();
    }

    // 2. Update User Stats
    const user = await User.findOne({ id: ratingData.targetId });
    if (user) {
      const count = user.ratingsCount || 0;
      const avg = user.averageRating || 0;
      const newCount = count + 1;
      const currentTotal = (count > 0) ? avg * count : 0;
      const newAvg = (currentTotal + ratingData.rating) / newCount;
      
      user.averageRating = newAvg;
      user.ratingsCount = newCount;
      await user.save();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MESSAGE ROUTES ---
app.get('/api/messages/:postingId', async (req, res) => {
  try {
    const messages = await ChatMessage.find({ postingId: req.params.postingId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/messages', async (req, res) => {
  try {
    const msg = await ChatMessage.create(req.body);
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- NOTIFICATION ROUTES ---
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(notifs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const notif = await Notification.create(req.body);
    res.json(notif);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
