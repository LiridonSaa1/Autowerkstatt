import reviewVehiclesRouter from './review-vehicles';
import checkoutActivityRouter from './checkout-activity';
import bookingScheduleRouter from './booking-schedule';
import servicesRouter from './services';
import portfolioImagesRouter from './portfolio-images';
import integrationsRouter from './integrations';
import quotesRouter from './quotes';
import settingsRouter from './settings';
import contactRepliesRouter from './contact-replies';
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shopRouter from "./shop";
import adminRouter from "./admin";

const router: IRouter = Router();
router.use(checkoutActivityRouter);

router.use(healthRouter);
router.use(bookingScheduleRouter);
router.use(reviewVehiclesRouter);
router.use(servicesRouter);
router.use(portfolioImagesRouter);
router.use(shopRouter);
router.use(adminRouter);
router.use(settingsRouter);
router.use(contactRepliesRouter);
router.use(quotesRouter);
router.use(integrationsRouter);

export default router;
