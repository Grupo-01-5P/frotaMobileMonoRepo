import express from "express";
import * as controller from "../../controllers/maintenanceController.js";
import maintenanceValidator from "./maintenanceValidator.js";
import validator from "../../middlewares/validator.js";



const router = express.Router();

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", validator(maintenanceValidator), controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);
router.patch("/:id/aprovar", controller.aprovar); // Nova rota
router.patch("/:id/reprovar", controller.reprovar); // Nova rota

export default router;