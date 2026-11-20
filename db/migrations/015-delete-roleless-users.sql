-- Accounts whose email is in no role table (left behind by an email change or a removal) are deleted; the sync now
-- does this itself. Sessions, roles and tokens cascade; grades they saved keep no author.
DELETE FROM users u
WHERE NOT EXISTS (SELECT 1 FROM admins a WHERE lower(btrim(a.email)) = u.email)
  AND NOT EXISTS (SELECT 1 FROM teachers t WHERE lower(btrim(t.email)) = u.email)
  AND NOT EXISTS (SELECT 1 FROM students s WHERE lower(btrim(s.email)) = u.email);
