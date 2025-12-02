const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

// Define minimal schemas needed for user creation
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  emailVerifiedAt: Date,
  emails: [{ email: String, primary: Boolean }],
  profileImage: String,
  coverImage: String,
  phoneNumbers: Array,
  address: Object,
  dateOfBirth: Date,
  flights: Object,
  hotels: Object,
  customerId: String,
}, { timestamps: true });

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  provider: String,
  providerAccountId: String,
  type: String,
  password: String,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Account = mongoose.models.Account || mongoose.model("Account", accountSchema);

async function createStaticUser() {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/golobe_travel_agency";
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const email = "jhon@gamil.com";
    const password = "12345678";
    const firstName = "Jhon";
    const lastName = "Doe";

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`User ${email} already exists.`);
      
      // Check if account exists
      const existingAccount = await Account.findOne({ userId: existingUser._id, provider: "credentials" });
      if (!existingAccount) {
          console.log("Account missing for user, creating...");
           const hashedPassword = await bcrypt.hash(password, 10);
           await Account.create({
            userId: existingUser._id,
            provider: "credentials",
            providerAccountId: email,
            type: "credentials",
            password: hashedPassword,
          });
          console.log("Account created.");
      } else {
          console.log("Account also exists.");
      }

      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      firstName,
      lastName,
      email,
      emailVerifiedAt: new Date(),
      emails: [{ email, primary: true }],
      profileImage: "",
      coverImage: "",
      phoneNumbers: [],
      address: null,
      dateOfBirth: null,
      flights: {},
      hotels: {},
      customerId: null,
    });

    await Account.create({
      userId: user._id,
      provider: "credentials",
      providerAccountId: email,
      type: "credentials",
      password: hashedPassword,
    });

    console.log(`User created successfully:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

  } catch (error) {
    console.error("Error creating user:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

createStaticUser();
