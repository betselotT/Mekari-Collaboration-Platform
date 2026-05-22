import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";
import { MatchRequest } from "../models/MatchRequest";
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
  ]);
  console.log("Cleared existing data");

  const passwordHash = await bcrypt.hash("password123", 10);

  const users = await User.insertMany([
    {
      name: "Betselot Tesfa",
      email: "betselot@example.com",
      passwordHash,
      role: "expert",
      expertVerification: { status: "approved", reviewedAt: new Date() },
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
      role: "expert",
      expertVerification: { status: "approved", reviewedAt: new Date() },
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
      role: "expert",
      expertVerification: { status: "approved", reviewedAt: new Date() },
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
      role: "expert",
      expertVerification: { status: "approved", reviewedAt: new Date() },
      bio: "Passionate about power systems, electronics and embedded design.",
      expertise: [
        { subject: "Electrical Engineering", proficiency: "expert" },
        { subject: "Embedded Systems", proficiency: "advanced" },
      ],
      availabilityStatus: "offline",
      points: 190,
      badges: ["Power Systems"],
    },
    {
      name: "Database Mentor",
      email: "db@example.com",
      passwordHash,
      role: "expert",
      expertVerification: { status: "approved", reviewedAt: new Date() },
      bio: "Helps with MongoDB schema design, indexing, and performance tuning.",
      expertise: [
        { subject: "Databases", proficiency: "expert" },
        { subject: "MongoDB", proficiency: "advanced" },
      ],
      availabilityStatus: "online",
      points: 380,
      badges: ["Query Optimizer"],
    },
    {
      name: "DevOps Helper",
      email: "devops@example.com",
      passwordHash,
      role: "expert",
      expertVerification: { status: "approved", reviewedAt: new Date() },
      bio: "CI/CD, Docker, monitoring, and practical deployment advice.",
      expertise: [
        { subject: "DevOps", proficiency: "expert" },
        { subject: "Software Engineering", proficiency: "advanced" },
      ],
      availabilityStatus: "busy",
      points: 340,
      badges: ["Pipeline Builder"],
    },
    {
      name: "DSA Coach",
      email: "dsa@example.com",
      passwordHash,
      role: "expert",
      expertVerification: { status: "approved", reviewedAt: new Date() },
      bio: "Helps with algorithms, complexity, and interview-style problems.",
      expertise: [
        { subject: "Data Structures & Algorithms", proficiency: "expert" },
        { subject: "Software Engineering", proficiency: "advanced" },
      ],
      availabilityStatus: "online",
      points: 410,
      badges: ["Algorithm Ace"],
    },
    {
      name: "System Design Mentor",
      email: "systemdesign@example.com",
      passwordHash,
      role: "expert",
      expertVerification: { status: "approved", reviewedAt: new Date() },
      bio: "Distributed systems, scalability, and architecture reviews.",
      expertise: [
        { subject: "System Design", proficiency: "expert" },
        { subject: "Databases", proficiency: "advanced" },
      ],
      availabilityStatus: "online",
      points: 460,
      badges: ["Architect"],
    },
    {
      name: "Web Security Guide",
      email: "security@example.com",
      passwordHash,
      role: "expert",
      expertVerification: { status: "approved", reviewedAt: new Date() },
      bio: "OWASP, auth flows, and secure backend patterns.",
      expertise: [
        { subject: "Software Engineering", proficiency: "advanced" },
        { subject: "Web Security", proficiency: "expert" },
      ],
      availabilityStatus: "offline",
      points: 290,
      badges: ["Security First"],
    },
  ]);

  const [betselot, edom, mech, ee, dbMentor, devops, dsa, sysDesign, security] =
    users;

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
    {
      title: "Dockerizing a Node.js + MongoDB app for deployment",
      subject: "DevOps",
      createdBy: devops._id,
      participants: [devops._id, betselot._id],
      isSolved: false,
    },
    {
      title: "Time complexity confusion: nested loops with hash maps",
      subject: "Data Structures & Algorithms",
      createdBy: dsa._id,
      participants: [dsa._id],
      isSolved: false,
    },
    {
      title: "Designing a scalable notification service",
      subject: "System Design",
      createdBy: sysDesign._id,
      participants: [sysDesign._id, edom._id],
      isSolved: false,
    },
    {
      title: "JWT best practices and token storage in SPAs",
      subject: "Web Security",
      createdBy: security._id,
      participants: [security._id],
      isSolved: false,
    },
  ]);

  const [t1, t2, t3, t4, t5, t6, t7, t8] = threads;

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
    {
      thread: t5._id,
      sender: devops._id,
      body: "What is the cleanest way to write a Dockerfile for a TS Node backend and run it with MongoDB locally?",
      isFromAi: false,
    },
    {
      thread: t5._id,
      sender: betselot._id,
      body: "Use multi-stage builds and a compose file for Mongo + backend; also keep node_modules out of the image build context.",
      isFromAi: false,
    },
    {
      thread: t6._id,
      sender: dsa._id,
      body: "I think this is O(n^2), but using a map inside the loop might change it? Need clarity.",
      isFromAi: false,
    },
    {
      thread: t7._id,
      sender: sysDesign._id,
      body: "We need fan-out to many users and retries. Which architecture would you recommend: queue-based or direct push?",
      isFromAi: false,
    },
    {
      thread: t8._id,
      sender: security._id,
      body: "Should I store JWT in localStorage or httpOnly cookies? What's the trade-off for XSS/CSRF?",
      isFromAi: false,
    },
  ]);

  // Demo match request: "user asks to be matched with experts"
  const matchThread = await Thread.create({
    title: "Need help designing MongoDB indexes for analytics queries",
    subject: "Databases",
    createdBy: betselot._id,
    participants: [betselot._id],
    isSolved: false,
  });

  await Message.create({
    thread: matchThread._id,
    sender: betselot._id,
    body: "I need guidance on compound indexes and query patterns for time-series analytics. Prefer chat or quick call.",
    isFromAi: false,
  });

  await MatchRequest.create({
    requester: betselot._id,
    thread: matchThread._id,
    subject: "Databases",
    tags: ["MongoDB", "Indexing", "Query Optimization"],
    availabilityPreference: "online_or_busy",
    questionnaire: {
      primaryTechnicalField: "Software Engineering",
      roleOrStatus: "Student",
      yearsOfExperience: "1–3 years",
      devicesUsed: ["Desktop/Laptop", "Smartphone"],
      helpFrequency: "Several times a week",
      currentPlatformsUsed: ["Stack Overflow", "Discord/Slack"],
      biggestChallenges: ["Difficulty finding experts", "Slow response times"],
      connectionPreferences: ["chat", "voice_video"],
      usageVision: "Quick questions and in-depth troubleshooting",
      crossDeviceImportance: 5,
    },
    status: "open",
    recommendations: [],
  });

  // Additional demo match requests to populate the dashboard
  const matchThread2 = await Thread.create({
    title: "Need guidance on DevOps pipeline for a Next.js app",
    subject: "DevOps",
    createdBy: edom._id,
    participants: [edom._id],
    isSolved: false,
  });
  await Message.create({
    thread: matchThread2._id,
    sender: edom._id,
    body: "Looking for a simple CI/CD setup (GitHub Actions) and deployment strategy. Prefer chat.",
    isFromAi: false,
  });
  await MatchRequest.create({
    requester: edom._id,
    thread: matchThread2._id,
    subject: "DevOps",
    tags: ["CI/CD", "Docker", "GitHub Actions"],
    availabilityPreference: "online_or_busy",
    questionnaire: {
      primaryTechnicalField: "Web Development",
      roleOrStatus: "Student",
      yearsOfExperience: "1–3 years",
      connectionPreferences: ["chat"],
    },
    status: "open",
    recommendations: [],
  });

  const matchThread3 = await Thread.create({
    title: "System design review for real-time chat",
    subject: "System Design",
    createdBy: betselot._id,
    participants: [betselot._id],
    isSolved: false,
  });
  await Message.create({
    thread: matchThread3._id,
    sender: betselot._id,
    body: "Need expert review: scaling socket.io, message persistence, and presence. Open to a call.",
    isFromAi: false,
  });
  await MatchRequest.create({
    requester: betselot._id,
    thread: matchThread3._id,
    subject: "System Design",
    tags: ["Socket.IO", "Scaling", "Architecture"],
    availabilityPreference: "any",
    questionnaire: {
      primaryTechnicalField: "Software Engineering",
      roleOrStatus: "Student",
      yearsOfExperience: "4–7 years",
      connectionPreferences: ["voice_video", "chat"],
    },
    status: "open",
    recommendations: [],
  });

  console.log("Seed data created.");
  await mongoose.disconnect();
  console.log("Disconnected. Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

