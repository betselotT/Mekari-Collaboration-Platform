import mongoose from "mongoose";
import { maskMongoUri, resolveMongoUri } from "./config/database";
import { Report } from "./models/Report";
import { Thread } from "./models/Thread";
import { User } from "./models/User";

type DiagramView = {
  name: string;
  source: string;
  pipeline: Record<string, unknown>[];
};

async function syncView(view: DiagramView) {
  const db = mongoose.connection.db;
  if (!db) return;

  const [existing] = await db.listCollections({ name: view.name }).toArray();
  if (existing?.type === "view") {
    await db.dropCollection(view.name);
  } else if (existing) {
    console.warn(
      `[database] Skipping ${view.name}: a real collection with that name already exists.`
    );
    return;
  }

  await db.createCollection(view.name, {
    viewOn: view.source,
    pipeline: view.pipeline,
  });
}

async function syncClassDiagramCollections() {
  const userCollection = User.collection.name;
  const reportCollection = Report.collection.name;

  const views: DiagramView[] = [
    {
      name: "Learner",
      source: userCollection,
      pipeline: [{ $match: { role: "learner" } }],
    },
    {
      name: "Expert",
      source: userCollection,
      pipeline: [{ $match: { role: "expert" } }],
    },
    {
      name: "Administrator",
      source: userCollection,
      pipeline: [
        { $limit: 1 },
        {
          $project: {
            _id: "administrator-dashboard",
            name: "Administrator",
            role: "admin",
            description: "Admin review workspace for reports and expert verification requests",
          },
        },
        {
          $lookup: {
            from: reportCollection,
            pipeline: [
              { $sort: { createdAt: -1 } },
              {
                $project: {
                  reporterId: 1,
                  targetType: 1,
                  targetId: 1,
                  reason: 1,
                  status: 1,
                  actionTaken: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
              { $limit: 25 },
            ],
            as: "reviewReports",
          },
        },
        {
          $lookup: {
            from: userCollection,
            pipeline: [
              {
                $match: {
                  role: "expert",
                  "expertVerification.status": { $in: ["pending", "approved", "rejected"] },
                },
              },
              {
                $sort: {
                  "expertVerification.submittedAt": -1,
                  createdAt: -1,
                },
              },
              {
                $project: {
                  name: 1,
                  email: 1,
                  expertise: 1,
                  skillTags: 1,
                  primaryTechnicalField: 1,
                  expertVerification: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
              { $limit: 25 },
            ],
            as: "verifyExperts",
          },
        },
        {
          $addFields: {
            reviewReportCount: { $size: "$reviewReports" },
            verifyExpertCount: { $size: "$verifyExperts" },
          },
        },
      ],
    },
  ];

  const results = await Promise.allSettled(views.map((view) => syncView(view)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(
        `[database] Could not sync ${views[index].name} class diagram view:`,
        result.reason
      );
    }
  });

  const db = mongoose.connection.db;
  const [notificationView] = db
    ? await db.listCollections({ name: "Notification" }).toArray()
    : [];
  if (notificationView?.type === "view") {
    await db?.dropCollection("Notification");
    console.log("Removed obsolete Notification class diagram view.");
  }

  console.log("MongoDB class diagram views are synced.");
}

async function normalizeLegacyData() {
  const [users, threads] = await Promise.all([
    User.updateMany({ role: "user" }, { $set: { role: "learner" } }),
    Thread.updateMany(
      { $or: [{ status: { $exists: false } }, { status: null }, { status: "" }] },
      { $set: { status: "OPEN" } }
    ),
  ]);

  if (users.modifiedCount || threads.modifiedCount) {
    console.log(
      `Normalized legacy data: ${users.modifiedCount} learner account(s), ${threads.modifiedCount} open thread(s).`
    );
  }
}

export async function connectDb() {
  const mongoUri = resolveMongoUri();
  console.log(`Connecting admin backend to MongoDB: ${maskMongoUri(mongoUri)}`);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log("Admin backend connected to MongoDB");
  await normalizeLegacyData();
  await syncClassDiagramCollections();
}
