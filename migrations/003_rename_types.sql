UPDATE launch_events SET type = 'public_beta' WHERE type = 'beta';
UPDATE launch_events SET type = 'other' WHERE type = 'launch';
