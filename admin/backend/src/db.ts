import mongoose from "mongoose";

export async function connectDb() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/mekari";
  const hostLabel = mongoUri.includes("@")
    ? mongoUri.replace(/\/\/.*@/, "//***@")
    : mongoUri;
  console.log(`Connecting admin backend to MongoDB: ${hostLabel}`);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log("Admin backend connected to MongoDB");
}
