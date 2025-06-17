import express from "express";
import * as controller from "../../controllers/inoperativeController.js";
import validator from "../../middlewares/validator.js";
import { verify } from "../../controllers/authController.js";

const router = express.Router();


router.get("/", controller.listInoperantVehicles);


router.get("/inoperative", (req, res, next) => {
  req.query.status = "aprovado";
  controller.listInoperantVehicles(req, res, next);
});


router.get("/completed", (req, res, next) => {
  req.query.status = "concluido";
  controller.listInoperantVehicles(req, res, next);
});


router.get("/:id/phase", verify, controller.getPhaseInfo);


router.put("/:id/phase", verify, controller.updatePhase);


router.get("/:id", controller.getById);

export default router;
