-- Run after importing the ExamGuard schema. Re-running resets this demo account's password.
INSERT INTO roles (role_name)
VALUES ('TEACHER')
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

INSERT INTO users (username, password_hash, role_id, full_name, email)
SELECT
  'ThsPhamTheAnh',
  '$2b$12$ouZQgX8oIvl/Y271jo7lxO4nC8m5.HfRHmfn9JPC9yXfZKJJVkpFm',
  roles.id,
  'ThS. Phạm Thế Anh',
  'thphamtheanh@examguard.edu.vn'
FROM roles
WHERE roles.role_name = 'TEACHER'
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role_id = VALUES(role_id),
  full_name = VALUES(full_name),
  email = VALUES(email);
