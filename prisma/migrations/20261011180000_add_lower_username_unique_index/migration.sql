-- case-insensitive uniqueness on username, like user_email_lower_key does for the email: the
-- username plugin already stores it lowercase, this makes the db refuse "Bob" next to "bob" even if
-- a row ever gets written some other way (#9)
CREATE UNIQUE INDEX "user_username_lower_key" ON "user" (LOWER("username"));
