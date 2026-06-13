import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { AttachmentRepository } from "../attachments/AttachmentRepository.js";
import { UserRepository } from "../users/UserRepository.js";
import { SettingsRepository } from "./SettingsRepository.js";
import {
  isPreferenceLocale,
  type PreferenceLocale,
  type UpdateUserPreferencesInput,
  type UserPreferences
} from "./settings.types.js";

const defaultLocale: PreferenceLocale = "zh-CN";
const defaultReducedMotion = false;
const defaultAvatarAttachmentId = null;

function authenticationError(): AppError {
  return new AppError("Authentication required.", {
    code: errorCodes.unauthorized,
    statusCode: 401
  });
}

function validateLocale(value: unknown): PreferenceLocale {
  if (!isPreferenceLocale(value)) {
    throw new AppError("locale must be zh-CN or en-US.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return value;
}

function validateReducedMotion(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new AppError("reduced_motion must be boolean.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return value;
}

function validateAvatarAttachmentId(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  const avatarAttachmentId = Number(value);

  if (!Number.isInteger(avatarAttachmentId) || avatarAttachmentId <= 0) {
    throw new AppError("avatar_attachment_id must be a positive integer or null.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return avatarAttachmentId;
}

export class UserPreferencesService {
  constructor(
    private readonly settingsRepository = new SettingsRepository(),
    private readonly userRepository = new UserRepository(),
    private readonly attachmentRepository = new AttachmentRepository()
  ) {}

  async getPreferences(userId: number): Promise<UserPreferences> {
    await this.requireActiveUser(userId);

    return (
      (await this.settingsRepository.getUserPreferences(userId)) ??
      (await this.settingsRepository.upsertUserPreferences({
        avatarAttachmentId: defaultAvatarAttachmentId,
        userId,
        locale: defaultLocale,
        reducedMotion: defaultReducedMotion
      }))
    );
  }

  async updatePreferences(userId: number, input: UpdateUserPreferencesInput): Promise<UserPreferences> {
    await this.requireActiveUser(userId);
    const currentPreferences = await this.getPreferences(userId);
    const avatarAttachmentId =
      input.avatarAttachmentId === undefined
        ? currentPreferences.avatarAttachmentId
        : await this.validateAvatarAttachment(userId, input.avatarAttachmentId);

    return this.settingsRepository.upsertUserPreferences({
      avatarAttachmentId,
      userId,
      locale: input.locale === undefined ? currentPreferences.locale : validateLocale(input.locale),
      reducedMotion:
        input.reducedMotion === undefined ? currentPreferences.reducedMotion : validateReducedMotion(input.reducedMotion)
    });
  }

  private async requireActiveUser(userId: number): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user || user.disabledAt) {
      throw authenticationError();
    }
  }

  private async validateAvatarAttachment(userId: number, value: unknown): Promise<number | null> {
    const avatarAttachmentId = validateAvatarAttachmentId(value);

    if (avatarAttachmentId === null) {
      return null;
    }

    const attachment = await this.attachmentRepository.findById(avatarAttachmentId);

    if (!attachment || attachment.deletedAt || attachment.ownerId !== userId || !attachment.mimeType.startsWith("image/")) {
      throw new AppError("avatar_attachment_id must reference one of the current user's uploaded images.", {
        code: errorCodes.validationFailed,
        statusCode: 400
      });
    }

    return avatarAttachmentId;
  }
}
