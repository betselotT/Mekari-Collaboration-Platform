const LOCAL_MONGO_URI = "mongodb://localhost:27017/mekari";

export function resolveMongoUri() {
  if (process.env.NODE_ENV === "production") {
    const productionUri =
      process.env.MONGO_URI_PROD ||
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      process.env.DATABASE_URL;

    if (!productionUri) {
      throw new Error("MongoDB is not configured. Set MONGO_URI_PROD or MONGO_URI in Render.");
    }

    return productionUri;
  }

  return (
    process.env.MONGO_URI_LOCAL ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    LOCAL_MONGO_URI
  );
}

export function maskMongoUri(uri: string) {
  return uri.includes("@") ? uri.replace(/\/\/.*@/, "//***@") : uri;
}
