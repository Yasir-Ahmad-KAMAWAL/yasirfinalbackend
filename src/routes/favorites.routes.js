import { Router } from "express";
import {
  toggleFavorite,
  getFavorites,
  getFavoriteStatus,
} from "../controllers/favorites.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require login
router.use(verifyJWT);

router.route("/").get(getFavorites);
router.route("/status").get(getFavoriteStatus);
router.route("/:taskId").post(toggleFavorite);

export default router;