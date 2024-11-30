import { RequestHandler } from "express";
import { sendErrorRes } from "utils/helper";
import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import UserModel from "models/user";
import PassResetTokenModel from "src/models/passwordResetToken";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  avatar?: string;
  address?: string;
  isAdmin: boolean;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user: UserProfile;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET!;

export const isAuth: RequestHandler = async (req, res, next) => {
  try {
    const authToken = req.headers.authorization;
    if (!authToken) return sendErrorRes(res, "Yêu cầu không hợp lệ!", 403);

    const token = authToken.split("Bearer ")[1];
    const payload = jwt.verify(token, JWT_SECRET) as { id: string };

    const user = await UserModel.findById(payload.id);
    if (!user) return sendErrorRes(res, "Yêu cầu không hợp lệ!", 403);

    req.user = {
      id: user._id as string,
      email: user.email,
      name: user.name,
      verified: user.verified,
      avatar: user.avatar?.url,
      address: user.address,
      isAdmin: user.isAdmin,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return sendErrorRes(res, "Session expired!", 401);
    }

    if (error instanceof JsonWebTokenError) {
      return sendErrorRes(res, "Unauthorized assess!", 401);
    }

    next(error);
  }
};

export const isValidPassResetToken: RequestHandler = async (req, res, next) => {
  const { id, token } = req.body;
  const resetPassToken = await PassResetTokenModel.findOne({ owner: id });

  if (!resetPassToken)
    return sendErrorRes(
      res,
      "Yêu cầu không hợp lệ, mã xác thực đã hết hạn!",
      403
    );

  const matched = await resetPassToken.compareToken(token);

  if (!matched)
    return sendErrorRes(
      res,
      "Yêu cầu không hợp lệ, mã xác thực đã hết hạn!",
      403
    );

  next();
};
