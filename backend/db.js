
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb+srv://<db_username>:<db_password>@mark1.c8uceke.mongodb.net/?appName=Mark1";

const clientOptions = { 
  serverApi: { version: '1', strict: true, deprecationErrors: true } 
};

export const connectDB = async () => {
  try {
    // Check if placeholders are present in the URI
    if (uri.includes('<db_username>')) {
        console.warn("⚠️  MongoDB URI contains placeholders. Please update .env with actual credentials.");
        console.warn("⚠️  Attempting fallback to local MongoDB...");
        await mongoose.connect('mongodb://localhost:27017/mealers_connect');
    } else {
        // Connect to Atlas
        await mongoose.connect(uri, clientOptions);
        // Verify connection with a ping
        await mongoose.connection.db.admin().command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    console.log("✅ Database Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
    // process.exit(1); // Optional: Exit if DB is critical
  }
};
