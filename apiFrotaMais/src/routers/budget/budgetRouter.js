import express from "express";
import * as controller from "../../controllers/budgetController.js";
import budgetValidator from "./budgetValdator.js";
import validator from "../../middlewares/validator.js";



const router = express.Router();

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", validator(budgetValidator), controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);
router.post("/:orcamentoId/produtos", controller.addProductToOrcamento);
router.delete("/:orcamentoId/produtos/:produtoId", controller.removeProductFromOrcamento);

export default router;
