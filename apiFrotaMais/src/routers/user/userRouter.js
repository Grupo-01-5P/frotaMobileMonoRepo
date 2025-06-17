import express from "express";
import * as controller from "../../controllers/userController.js";
import userValidator from "./userValidator.js";
import validator from "../../middlewares/validator.js";



const router = express.Router();

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", validator(userValidator), controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

export default router;
