CREATE TABLE visit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  locale VARCHAR(10) NULL DEFAULT NULL,
  path VARCHAR(512) NOT NULL,
  country VARCHAR(80) NOT NULL DEFAULT 'Unknown',
  device_type VARCHAR(24) NOT NULL DEFAULT 'desktop',
  ip_hash CHAR(64) NULL DEFAULT NULL,
  user_agent VARCHAR(512) NULL DEFAULT NULL,
  referrer VARCHAR(512) NULL DEFAULT NULL,
  visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY visit_events_visited_at_index (visited_at),
  KEY visit_events_locale_visited_at_index (locale, visited_at),
  KEY visit_events_path_visited_at_index (path, visited_at),
  KEY visit_events_country_visited_at_index (country, visited_at),
  KEY visit_events_device_visited_at_index (device_type, visited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
