import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";

dotenv.config();

async function run() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mekari";
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  await Promise.all([User.deleteMany({}), Thread.deleteMany({}), Message.deleteMany({})]);
  console.log("Cleared existing data");

  const passwordHash = await bcrypt.hash("password123", 10);

  const users = await User.insertMany([
    {
      name: "Betselot Tesfa",
      email: "betselot@example.com",
      passwordHash,
      bio: "Senior software engineering student focusing on backend systems.",
      expertise: [
        { subject: "Software Engineering", proficiency: "expert" },
        { subject: "Data Structures & Algorithms", proficiency: "advanced" },
      ],
      availabilityStatus: "online",
      points: 420,
      badges: ["Top Helper", "Backend Guru"],
    },
    {
      name: "Edom Mulugeta",
      email: "edom@example.com",
      passwordHash,
      bio: "Enjoys frontend engineering and UI/UX.",
      expertise: [
        { subject: "Web Development", proficiency: "advanced" },
        { subject: "Human-Computer Interaction", proficiency: "intermediate" },
      ],
      availabilityStatus: "busy",
      points: 310,
      badges: ["UI Whisperer"],
    },
    {
      name: "Mechanical Mentor",
      email: "mech@example.com",
      passwordHash,
      bio: "Helps with dynamics, thermodynamics and design projects.",
      expertise: [
        { subject: "Mechanical Engineering", proficiency: "expert" },
        { subject: "Engineering Mechanics", proficiency: "advanced" },
      ],
      availabilityStatus: "online",
      points: 260,
      badges: ["Cross-Discipline Helper"],
    },
    {
      name: "Electrical Guide",
      email: "ee@example.com",
      passwordHash,
      bio: "Passionate about power systems, electronics and embedded design.",
      expertise: [
        { subject: "Electrical Engineering", proficiency: "expert" },
        { subject: "Embedded Systems", proficiency: "advanced" },
      ],
      availabilityStatus: "offline",
      points: 190,
      badges: ["Power Systems"],
    },
  ]);

  const [betselot, edom, mech, ee] = users;

  const threads = await Thread.insertMany([
    {
      title: "Null pointer exception in Node.js service",
      subject: "Software Engineering",
      createdBy: betselot._id,
      participants: [betselot._id, edom._id],
      isSolved: false,
    },
    {
      title: "Choosing proper indexing strategy for MongoDB",
      subject: "Databases",
      createdBy: betselot._id,
      participants: [betselot._id],
      isSolved: false,
    },
    {
      title: "Stability issue in a cantilever beam design",
      subject: "Civil Engineering",
      createdBy: mech._id,
      participants: [mech._id],
      isSolved: false,
    },
    {
      title: "Sizing a transformer for lab power supply",
      subject: "Electrical Engineering",
      createdBy: ee._id,
      participants: [ee._id],
      isSolved: false,
    },
  ]);

  const [t1, t2, t3, t4] = threads;

  await Message.insertMany([
    {
      thread: t1._id,
      sender: betselot._id,
      body: "I keep getting a null pointer exception when accessing req.user in my Express middleware. Any ideas?",
      isFromAi: false,
    },
    {
      thread: t1._id,
      sender: edom._id,
      body: "Check if the auth middleware attaches user before this route, and make sure you're handling missing tokens gracefully.",
      isFromAi: false,
    },
    {
      thread: t2._id,
      sender: betselot._id,
      body: "I have a collection with millions of documents, mostly filtered by userId and createdAt. Should I use a compound index?",
      isFromAi: false,
    },
    {
      thread: t3._id,
      sender: mech._id,
      body: "My simulation shows excessive deflection under load. Which checks should I prioritize for this beam?",
      isFromAi: false,
    },
    {
      thread: t4._id,
      sender: ee._id,
      body: "Need help confirming transformer turns ratio and power rating for a lab project.",
      isFromAi: false,
    },
  ]);

  console.log("Seed data created.");
  await mongoose.disconnect();
  console.log("Disconnected. Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

