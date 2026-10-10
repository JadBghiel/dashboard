-- case-insensitive uniqueness on email: the databaseHooks in lib/auth.ts already lowercases new
-- emails, this is the db-level guarantee for any row inserted through another path
CREATE UNIQUE INDEX "user_email_lower_key" ON "user" (LOWER("email"));