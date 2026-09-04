// Erovians — MongoDB one-time initialization script
//
// Run by the `mongo-init` service in compose.yaml, via:
//   mongosh "mongodb://<root>:<pass>@mongodb:27017/admin?directConnection=true" init.js
//
// Executes after the `mongodb` service reports healthy (i.e. mongod is up,
// running with --replSet and --auth already active, and the root user has
// already been created by the official image's own bootstrap logic).
//
// Responsibilities, both idempotent — safe to re-run if this container
// restarts against an already-initialized deployment:
//   1. Initiate the single-node replica set, if not already initiated.
//   2. Create the application database + least-privilege application user,
//      scoped to readWrite on that one database only — never admin/root.

const replicaSetName = process.env.MONGO_REPLICA_SET_NAME || "erovians-rs0";
const appDbName = process.env.MONGO_APP_DB;
const appUser = process.env.MONGO_APP_USER;
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!appDbName || !appUser || !appPassword) {
  throw new Error(
    "[mongo-init] MONGO_APP_DB, MONGO_APP_USER and MONGO_APP_PASSWORD must all be set"
  );
}

// ── 1. Replica set ──────────────────────────────────────────────────────

function isReplicaSetInitiated() {
  try {
    const status = rs.status();
    return status.ok === 1;
  } catch (err) {
    // "NotYetInitialized" (94) is the expected error on a fresh node.
    return false;
  }
}

if (!isReplicaSetInitiated()) {
  print(`[mongo-init] Initiating replica set "${replicaSetName}"...`);
  const result = rs.initiate({
    _id: replicaSetName,
    members: [{ _id: 0, host: "mongodb:27017" }],
  });

  if (result.ok !== 1) {
    throw new Error(`[mongo-init] rs.initiate() failed: ${JSON.stringify(result)}`);
  }

  // A single-node replica set elects itself PRIMARY almost immediately,
  // but createUser() below needs a writable primary — a short fixed wait
  // is simpler and just as reliable here as polling rs.status() in a loop.
  print("[mongo-init] Waiting for this node to become PRIMARY...");
  sleep(3000);
  print("[mongo-init] Replica set initiated.");
} else {
  print(`[mongo-init] Replica set "${replicaSetName}" already initiated — skipping.`);
}

// ── 2. Application database + user ──────────────────────────────────────

const appDb = db.getSiblingDB(appDbName);
const existingUser = appDb.getUser(appUser);

if (!existingUser) {
  print(`[mongo-init] Creating application user "${appUser}" on database "${appDbName}"...`);
  appDb.createUser({
    user: appUser,
    pwd: appPassword,
    roles: [{ role: "readWrite", db: appDbName }],
  });
  print("[mongo-init] Application user created.");
} else {
  print(`[mongo-init] Application user "${appUser}" already exists — skipping.`);
}

print("[mongo-init] Initialization complete.");
