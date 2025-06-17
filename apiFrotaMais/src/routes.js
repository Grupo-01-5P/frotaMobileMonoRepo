import { Router } from "express";

import NotFound from "./routers/helpers/404.js";
import InternalServerError from "./routers/helpers/500.js";

import hateos from "./middlewares/hateos.js";
import handler from "./middlewares/handler.js";

import AuthRouter from "./routers/auth/authRouter.js"
import UserRouter from "./routers/user/userRouter.js"
import BudgetRouter from "./routers/budget/budgetRouter.js"
import MaintenanceRouter from "./routers/maintenance/maintenanceRouter.js"
import GarageRouter from "./routers/garage/garageRouter.js"
import VehicleRouter from "./routers/vehicle/vehicleRouter.js"
import InoperativeRouter from "./routers/inoperative/inoperativeRouter.js"
import ProductRouter from "./routers/products/productsRouter.js"

import { verify } from "./controllers/authController.js"

const routes = Router()
routes.use(hateos);
routes.use(handler);

routes.use("/login", AuthRouter)

routes.use("/orcamento", verify, BudgetRouter)
routes.use("/api/users", verify, UserRouter)
routes.use("/api/maintenance", verify, MaintenanceRouter)
routes.use("/api/garage", verify, GarageRouter)
routes.use("/api/veiculos", verify, VehicleRouter);
routes.use("/inoperative", InoperativeRouter)
routes.use("/api/products/search", ProductRouter) // Rota pública para busca
routes.use("/api/products", verify, ProductRouter) // Rotas protegidas

routes.use(InternalServerError)
routes.use(NotFound);

export default routes;