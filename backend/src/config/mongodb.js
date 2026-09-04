// MongoDB connection — thin re-export of the shared connection module
// (../../../shared/database/mongodb/connection/index.js), so server/ and
// chat-server/ use exactly one connection implementation instead of two
// diverging copies. This file's own implementation from Milestone 1 has
// been superseded by the shared package built in Milestone 2, Step 1.
//
// Wraps the shared module's calls with this app's own winston logger, so
// existing log output/format is unchanged for anything already watching
// server/'s logs.
import {
  connectMongo as sharedConnectMongo,
  disconnectMongo as sharedDisconnectMongo,
  mongoose,
} from "../../../shared/database/mongodb/connection/index.js";
import logger from "./logger.js";

export async function connectMongo() {
  return sharedConnectMongo({ logger });
}

export async function disconnectMongo() {
  return sharedDisconnectMongo({ logger });
}

export default mongoose;
