import express from "express";
import * as controller from "../../controllers/vehicleController.js";
import vehicleValidator from "./vehicleValidator.js";
import validator from "../../middlewares/validator.js";



const router = express.Router();

router.get("/", controller.list);
router.get("/withoutSupervisior", controller.getVehiclesWithoutSupervisor);
router.get("/available", controller.getAvailable);
router.get("/:id", controller.getById);
router.post("/", validator(vehicleValidator), controller.create);
router.put("/:id", validator(vehicleValidator), controller.update);
router.delete("/:id", controller.remove);

export default router;



