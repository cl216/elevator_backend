CREATE EXTENSION postgis;
SELECT PostGIS_Version();
-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('LEARNER', 'TEACHER')) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- TEACHER PROFILES
CREATE TABLE teacher_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- CLASSES
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- SESSIONS
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  start_time TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL,
  max_participants INTEGER NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- BOOKINGS
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (session_id, user_id)
);

-- REVIEWS
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX sessions_location_idx ON sessions USING GIST(location);
CREATE INDEX sessions_start_time_idx ON sessions(start_time);
CREATE INDEX bookings_session_idx ON bookings(session_id);
CREATE INDEX classes_teacher_idx ON classes(teacher_id);
-- Teacher
INSERT INTO users (email, password_hash, role)
VALUES ('teacher@test.com', 'fakehash', 'TEACHER')
RETURNING id;

-- Class (replace TEACHER_ID_HERE)
INSERT INTO classes (teacher_id, title, category, price_cents)
VALUES ('TEACHER_ID_HERE', 'Beginner Guitar', 'Music', 4000)
RETURNING id;

-- Session (replace CLASS_ID_HERE)
INSERT INTO sessions (
  class_id, start_time, duration_minutes, max_participants, location
)
VALUES (
  'CLASS_ID_HERE',
  now() + interval '1 day',
  60,
  5,
  ST_SetSRID(ST_MakePoint(-0.1278, 51.5074), 4326)
)
RETURNING id;

-- Test query
SELECT id, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM sessions;


