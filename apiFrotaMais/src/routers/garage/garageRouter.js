import express from "express";
import * as controller from "../../controllers/garageController.js";
import mechanicsValidator from "./garageValidator.js";
import validator from "../../middlewares/validator.js";

const router = express.Router();

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", validator(mechanicsValidator), controller.create);
router.put("/:id", validator(mechanicsValidator), controller.update);
router.delete("/:id", controller.remove);

export default router;