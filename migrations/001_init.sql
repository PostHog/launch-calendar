CREATE TABLE calendar_sync (
  calendar_id text PRIMARY KEY,
  sync_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE launch_events (
  calendar_id text NOT NULL,
  event_id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  owner_email text,
  html_link text,
  links jsonb NOT NULL DEFAULT '[]',
  reminded_for_start date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (calendar_id, event_id)
);

CREATE INDEX launch_events_dates_idx ON launch_events (start_date, end_date);

CREATE TABLE digests (
  week_start date PRIMARY KEY,
  channel_id text NOT NULL,
  message_ts text,
  posted_at timestamptz NOT NULL DEFAULT now()
);
