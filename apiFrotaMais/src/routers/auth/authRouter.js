import { Router } from "express";
import { login } from "../../controllers/userController.js";
import { generate } from "../../controllers/authController.js";

import validator from "../../middlewares/validator.js";
import authValidator from "./authValidator.js";

const router = Router();
router.post("/", validator(authValidator));
router.post("/", login, generate);

export default router;
