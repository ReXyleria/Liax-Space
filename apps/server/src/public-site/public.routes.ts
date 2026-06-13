import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { PublicArticleController } from "./PublicArticleController.js";

const publicArticleController = new PublicArticleController();

export const publicRoutes = Router();

publicRoutes.get("/:localePrefix", asyncHandler(publicArticleController.getHome));
publicRoutes.get("/:localePrefix/posts/:slug", asyncHandler(publicArticleController.getArticle));
publicRoutes.get("/:localePrefix/tags/:slug", asyncHandler(publicArticleController.getTagDetail));
publicRoutes.get("/:localePrefix/:section", asyncHandler(publicArticleController.getSection));
