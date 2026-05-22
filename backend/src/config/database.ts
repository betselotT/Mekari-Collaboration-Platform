const LOCAL_MONGO_URI = "mongodb://localhost:27017/mekari";

export function resolveMongoUri() {
  if (process.env.NODE_ENV === "production") {
    return process.env.MONGO_URI_PROD || process.env.MONGO_URI || LOCAL_MONGO_URI;
  }

  return process.env.MONGO_URI_LOCAL || process.env.MONGO_URI || LOCAL_MONGO_URI;
}

export function maskMongoUri(uri: string) {
  return uri.includes("@") ? uri.replace(/\/\/.*@/, "//***@") : uri;
}
