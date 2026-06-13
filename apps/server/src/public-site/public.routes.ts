import { Router } from "express";
import type { NextFunction, Request, Response } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { PublicArticleController } from "./PublicArticleController.js";

const publicArticleController = new PublicArticleController();

export const publicRoutes = Router();

export function isPublicLocalePrefix(value: string | undefined): value is "zh" | "en" {
  return value === "zh" || value === "en";
}

function requirePublicLocalePrefix(request: Request, _response: Response, next: NextFunction): void {
  if (!isPublicLocalePrefix(request.params.localePrefix)) {
    next("route");
    return;
  }

  next();
}

publicRoutes.get("/:localePrefix", requirePublicLocalePrefix, asyncHandler(publicArticleController.getHome));
publicRoutes.get("/:localePrefix/posts/:slug", requirePublicLocalePrefix, asyncHandler(publicArticleController.getArticle));
publicRoutes.get("/:localePrefix/tags/:slug", requirePublicLocalePrefix, asyncHandler(publicArticleController.getTagDetail));
publicRoutes.get("/:localePrefix/:section", requirePublicLocalePrefix, asyncHandler(publicArticleController.getSection));
