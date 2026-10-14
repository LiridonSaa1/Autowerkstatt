import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shopRouter from "./shop";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(shopRouter);
router.use(adminRouter);

export default router;
