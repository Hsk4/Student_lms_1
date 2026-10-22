import mongoose from "mongoose";
import dns from "node:dns";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable");
}

// Windows dev: a local DNS stub can refuse SRV lookups for mongodb+srv strings.
if (
  process.env.NODE_ENV === "development" &&
  MONGODB_URI.startsWith("mongodb+srv://")
) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const cached = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI environment variable');
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

/** Runs a multi-document mutation in a Mongo transaction. */
export async function withTransaction<T>(
  callback: (session: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  const conn = await connectDB();
  const session = await conn.startSession();

  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
