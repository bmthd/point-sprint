-- The sync of a user's data between their devices (src/server/sync-store.ts). The rows are sealed on
-- the devices: the server keeps what it needs to pick the later row and nothing it could read.

-- One per user who started to sync. Nothing here names the user.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  -- The newest data version written: older apps may no longer write.
  schema_version INTEGER NOT NULL,
  -- The size of every record's body, against the quota.
  bytes INTEGER NOT NULL DEFAULT 0,
  -- A hash of a key made from the recovery code, to log in with the code.
  recovery_verifier TEXT NOT NULL UNIQUE,
  -- The data's secret, sealed with a key made from the recovery code.
  recovery_wrap TEXT NOT NULL
);

-- The passkeys of each account.
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT,
  -- The data's secret, sealed with a key made from this passkey's PRF output, if it gave one.
  prf_wrap TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX credentials_by_account ON credentials(account_id);

-- Logged-in devices, by a hash of their cookie's token.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- WebAuthn challenges, each used once.
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  purpose TEXT NOT NULL,
  account_id TEXT,
  expires_at TEXT NOT NULL
);

-- One sealed row of a user's data.
CREATE TABLE records (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  deleted INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (account_id, record_id)
);
CREATE INDEX records_by_seq ON records(account_id, seq);

-- Records written per account and hour, against the rate limit.
CREATE TABLE usage (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  hour TEXT NOT NULL,
  writes INTEGER NOT NULL,
  PRIMARY KEY (account_id, hour)
);
