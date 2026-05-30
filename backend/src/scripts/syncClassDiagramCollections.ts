import mongoose from "mongoose";
import dotenv from "dotenv";
import { syncClassDiagramCollections } from "../config/classDiagramCollections";

dotenv.config();

async function run() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/mekari";
  const hostLabel = mongoUri.includes("@") ? mongoUri.replace(/\/\/.*@/, "//***@") : mongoUri;

  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB: ${hostLabel}`);
  await syncClassDiagramCollections();

  const db = mongoose.connection.db;
  if (db) {
    const collections = await db
      .listCollections({
        name: { $in: ["Learner", "Expert", "Administrator"] },
      })
      .toArray();

    console.table(
      collections.map((collection) => ({
        name: collection.name,
        type: collection.type || "collection",
      }))
    );
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
