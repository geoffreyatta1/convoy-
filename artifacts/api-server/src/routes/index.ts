import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agoraTokenRouter from "./agora-token";
import hazardsRouter from "./hazards";
import aiCommandRouter from "./ai-command";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agoraTokenRouter);
router.use(hazardsRouter);
router.use(aiCommandRouter);
router.use(stripeRouter);

export default router;
