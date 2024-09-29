CREATE TABLE transcript_segments (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    uid VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    speaker VARCHAR(255) NOT NULL,
    speaker_id INTEGER NOT NULL,
    is_user BOOLEAN NOT NULL,
    start_time FLOAT NOT NULL
);


CREATE INDEX idx_transcript_segments_session_id ON transcript_segments(session_id);


CREATE INDEX idx_transcript_segments_uid ON transcript_segments(uid);