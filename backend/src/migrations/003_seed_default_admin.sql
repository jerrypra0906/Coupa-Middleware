-- Seed default admin user
-- Password: admin123 (change in production!)
-- This will be hashed using bcrypt

-- Note: In a real application, you should run this migration and then manually set a secure password
-- For now, we'll create a placeholder that needs to be updated

-- The password_hash below is for 'admin123' - generated using bcrypt with 10 rounds
-- To generate a new hash, use: bcrypt.hash('your-password', 10)
INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
  'admin',
  'admin@coupa-middleware.local',
  '$2a$10$rOzJqZqZqZqZqZqZqZqZqOZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq', -- Placeholder - needs to be updated
  'ADMIN',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- Note: After running this migration, you should update the password_hash manually
-- or use the /api/auth/register endpoint to create the admin user with a secure password

