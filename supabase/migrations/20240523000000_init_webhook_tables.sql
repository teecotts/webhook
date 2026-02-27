-- Create instantly_events table for webhook logging and idempotency
CREATE TABLE IF NOT EXISTS instantly_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'instantly',
    provider_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    email TEXT NOT NULL,
    campaign_id TEXT,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create dead_letters table for reliability
CREATE TABLE IF NOT EXISTS dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    provider_event_id TEXT,
    payload JSONB NOT NULL,
    error JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_instantly_events_provider_event_id ON instantly_events(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_instantly_events_email ON instantly_events(email);
CREATE INDEX IF NOT EXISTS idx_instantly_events_event_type ON instantly_events(event_type);
