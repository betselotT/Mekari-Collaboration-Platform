import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";
import { MatchRequest } from "../models/MatchRequest";
import { BadgeEvent } from "../models/BadgeEvent";
import { CertificateEvent } from "../models/CertificateEvent";
import { syncClassDiagramCollections } from "../config/classDiagramCollections";

dotenv.config();

async function run() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mekari";
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");
  await syncClassDiagramCollections();

  await Promise.all([
    User.deleteMany({}),
    Thread.deleteMany({}),
    Message.deleteMany({}),
    MatchRequest.deleteMany({}),
    BadgeEvent.deleteMany({}),
    CertificateEvent.deleteMany({}),
  ]);
  console.log("Cleared existing data");

  console.log("Demo users removed. No dummy user data was seeded.");
  await mongoose.disconnect();
  console.log("Disconnected. Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
