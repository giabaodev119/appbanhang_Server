import { Router } from "express";
import { isAuth } from "middleware/auth";
import filePaser from "middleware/fileParser";
import validate from "middleware/validator";
import {
  createPaymentPage,
  createPaymentUrl,
  vnpayReturn,
} from "src/controllers/vnpay";

const paymentRouter = Router();

paymentRouter.get("/create_payment_url", createPaymentPage);

paymentRouter.post("/create_payment_url", createPaymentUrl);

paymentRouter.get("/vnpay_return", vnpayReturn);

export default paymentRouter;
