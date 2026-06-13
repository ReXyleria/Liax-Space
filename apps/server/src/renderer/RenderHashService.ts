import { sha256 } from "../common/sha256.js";
import type { RenderHashInput } from "./renderer.types.js";

export class RenderHashService {
  calculateRenderHash(input: RenderHashInput): string {
    return sha256(input.contentHash + input.rendererVersion + input.templateVersion + input.customRuleVersion);
  }
}
