export const SESSION_COOKIE_NAME = "liax_space_session";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const TRUSTED_DEVICE_COOKIE_NAME = "liax_space_trusted_device";

export const LOCALE_COOKIE_NAME = "liax_space_locale";

export const TRUSTED_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const UPLOAD_MAX_SIZE = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
] as const;
