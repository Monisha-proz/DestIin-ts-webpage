const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

// Minimal schemas for testing
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  firstName: String,
  lastName: String,
}, { timestamps: true });

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  provider: String,
  password: String,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Account = mongoose.models.Account || mongoose.model("Account", accountSchema);

async function testLogin() {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/golobe_travel_agency";
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const email = "jhon@gamil.com";
    const password = "12345678";

    console.log(`Testing login for: ${email}`);

    // Simulate getOneDoc for User
    const user = await User.findOne({ email });
    if (!user) {
      console.error("User not found!");
      process.exit(1);
    }
    console.log("User found:", user._id);

    // Simulate getOneDoc for Account
    const account = await Account.findOne({ userId: user._id, provider: "credentials" });
    if (!account) {
      console.error("Account not found!");
      process.exit(1);
    }
    console.log("Account found.");

    // Verify Password
    const isValid = await bcrypt.compare(password, account.password);
    if (isValid) {
      console.log("LOGIN SUCCESS: Password matches.");
    } else {
      console.error("LOGIN FAILED: Password does not match.");
      console.log("Stored hash:", account.password);
      const newHash = await bcrypt.hash(password, 10);
      console.log("Expected hash for '12345678':", newHash);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

testLogin();
