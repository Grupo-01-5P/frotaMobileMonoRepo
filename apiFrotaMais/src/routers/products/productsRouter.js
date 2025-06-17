import express from "express";
import * as controller from "../../controllers/productsController.js";
import validator from "../../middlewares/validator.js";
import { verify } from "../../controllers/authController.js";

const router = express.Router();

router.get("/", verify, controller.listProducts);
router.get("/getByName", controller.getByName);
router.post("/createProduct", verify, controller.createProduct);
router.put("/updateProduct/:nome", verify, controller.updateProduct);
router.delete("/deleteProduct/:nome", verify, controller.deleteProduct);

export default router;
