import { Router } from "express";
import {
  createNewUser,
  generateForgotPassLink,
  generateVerificationLink,
  grantAccessToken,
  grantValid,
  sendProfile,
  signIn,
  signOut,
  verifyEmail,
  updatePassword,
  updateProfile,
  updateAvatar,
  sendPublicProfile,
} from "controllers/auth";
import validate from "middleware/validator";
import {
  newUserSchema,
  resetPassSchema,
  verifyTokenSchema,
} from "utils/validationSchema";
import { isAuth, isValidPassResetToken } from "middleware/auth";
import filePaser from "src/middleware/fileParser";

const authRouter = Router();

authRouter.post("/sign-up", validate(newUserSchema), createNewUser);
authRouter.post("/verify", validate(verifyTokenSchema), verifyEmail);
authRouter.get("/verify-token", isAuth, generateVerificationLink);
authRouter.post("/sign-in", signIn);
authRouter.get("/profile", isAuth, sendProfile);
authRouter.post("/refresh-token", grantAccessToken);
authRouter.post("/sign-out", isAuth, signOut);
authRouter.post("/forget-pass", generateForgotPassLink);
authRouter.post(
  "/verify-pass-reset-token",
  validate(verifyTokenSchema),
  isValidPassResetToken,
  grantValid
);

authRouter.post(
  "/reset-pass",
  validate(resetPassSchema),
  isValidPassResetToken,
  updatePassword
);

authRouter.patch("/update-profile", isAuth, updateProfile);
authRouter.patch("/update-avatar", isAuth, filePaser, updateAvatar);
authRouter.get("/profile/:id", isAuth, sendPublicProfile);

export default authRouter;
