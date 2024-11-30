import { RequestHandler } from "express";
import UserModel from "models/user";
import crypto, { verify } from "crypto";
import AuthVerificationTokenModel from "models/authVerificationToken";
import { sendErrorRes } from "utils/helper";
import jwt from "jsonwebtoken";
import mail from "src/utils/mail";
import PassResetTokenModel from "src/models/passwordResetToken";
import { isValidObjectId } from "mongoose";
import cloudUploader from "src/cloud";

const VERIFICATION_LINK = process.env.VERIFICATION_LINK;
const JWT_SECRET = process.env.JWT_SECRET!;
const PASSWORD_RESET_LINK = process.env.PASSWORD_RESET_LINK!;

export const createNewUser: RequestHandler = async (req, res) => {
  // đọc dữ liệu nhận vào
  const { email, password, name, provinceName, districtName } = req.body;
  // kiểm tra user đã tồn tại hay chưa
  const existingUser = await UserModel.findOne({ email });

  const address = provinceName + "_" + districtName;

  if (existingUser) {
    return sendErrorRes(
      res,
      "Yêu cầu của bạn không hợp lệ, email đã được sử dụng!",
      401
    );
  }
  // tạo user mới nếu email chưa tồn tại trong db
  const user = await UserModel.create({ email, password, name, address });

  // tạo và lưu trữ verification token
  const token = crypto.randomBytes(36).toString("hex");
  await AuthVerificationTokenModel.create({ owner: user._id, token });

  // gởi mã xác thực cho email đăng kí

  const link = `${VERIFICATION_LINK}?id=${user._id}&token=${token}`;

  // Looking to send emails in production? Check out our Email API/SMTP product!
  await mail.sendVerification(user.email, link);

  res.json({ message: "Hãy kiểm tra hộp thư của bạn" });
};

export const verifyEmail: RequestHandler = async (req, res) => {
  const { id, token } = req.body;

  const authToken = await AuthVerificationTokenModel.findOne({ owner: id });

  if (!authToken)
    return sendErrorRes(res, "Yêu cầu của bạn không hợp lệ!", 403);

  const isMatched = await authToken.compareToken(token);
  if (!isMatched)
    return sendErrorRes(
      res,
      "Yêu cầu của bạn không hợp lệ, token không đúng!",
      403
    );

  await UserModel.findByIdAndUpdate(id, { verified: true });

  await AuthVerificationTokenModel.findByIdAndDelete(authToken._id);

  res.json({
    message: "Cảm ơn bạn đã đăng kí, email của bạn đã được xác thực.",
  });
};

export const generateVerificationLink: RequestHandler = async (req, res) => {
  const { id } = req.user;
  const token = crypto.randomBytes(36).toString("hex");

  const link = `${VERIFICATION_LINK}?id=${id}&token=${token}`;

  await AuthVerificationTokenModel.findOneAndDelete({ owner: id });

  await AuthVerificationTokenModel.create({ owner: id, token });

  await mail.sendVerification(req.user.email, link);

  res.json({ message: "Hãy kiểm tra hộp thư của bạn" });
};

export const signIn: RequestHandler = async (req, res) => {
  const { email, password } = req.body;

  const user = await UserModel.findOne({ email });
  if (!user)
    return sendErrorRes(
      res,
      "Email hoặc mật khẩu của bạn không trùng khớp!",
      403
    );

  const isMatched = await user.comparePassword(password);
  if (!isMatched)
    return sendErrorRes(
      res,
      "Email hoặc mật khẩu của bạn không trùng khớp!",
      403
    );

  const payload = { id: user._id };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: "15m",
  });

  const refreshToken = jwt.sign(payload, JWT_SECRET);

  if (!user.tokens) user.tokens = [refreshToken];
  else user.tokens.push(refreshToken);

  await user.save();

  res.json({
    profile: {
      id: user._id,
      email: user.email,
      name: user.name,
      verified: user.verified,
      avatar: user.avatar?.url,
      address: user?.address,
      isAdmin: user.isAdmin,
      isActive: user.isActive,
    },
    tokens: { refresh: refreshToken, access: accessToken },
  });
};

export const sendProfile: RequestHandler = async (req, res) => {
  res.json({
    profile: req.user,
  });
};

export const grantAccessToken: RequestHandler = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return sendErrorRes(res, "Yêu cầu không hợp lệ!", 403);

  const payload = jwt.verify(refreshToken, JWT_SECRET) as { id: string };

  if (!payload.id) return sendErrorRes(res, "Yêu cầu không hợp lệ!", 401);

  const user = await UserModel.findOne({
    _id: payload.id,
    tokens: refreshToken,
  });

  if (!user) {
    await UserModel.findByIdAndUpdate(payload.id, { token: [] });
    return sendErrorRes(res, "Yêu cầu không hợp lệ!", 401);
  }

  const newAccessToken = jwt.sign({ id: user._id }, JWT_SECRET, {
    expiresIn: "15m",
  });

  const newRefreshToken = jwt.sign({ id: user._id }, JWT_SECRET);

  const filteredTokens = user.tokens.filter((t) => t !== refreshToken);
  user.tokens = filteredTokens;
  user.tokens.push(newRefreshToken);
  await user.save();

  res.json({
    profile: {
      id: user._id,
      email: user.email,
      name: user.name,
      verified: user.verified,
      avatar: user.avatar?.url,
      address: user?.address,
    },
    tokens: { refresh: newRefreshToken, access: newAccessToken },
  });
};

export const signOut: RequestHandler = async (req, res) => {
  const { refreshToken } = req.body;
  const user = await UserModel.findOne({
    _id: req.user.id,
    tokens: refreshToken,
  });
  if (!user)
    return sendErrorRes(
      res,
      "Yêu cầu không hợp lệ, không tìm thấy người dùng!",
      403
    );

  const newTokens = user.tokens.filter((t) => t !== refreshToken);
  user.tokens = newTokens;
  await user.save();

  res.send();
};
export const generateForgotPassLink: RequestHandler = async (req, res) => {
  const { email } = req.body;

  const user = await UserModel.findOne({ email });

  if (!user) return sendErrorRes(res, "Không tìm thấy tài khoản!", 404);

  await PassResetTokenModel.findOneAndDelete({ owner: user._id });

  const token = crypto.randomBytes(36).toString("hex");
  await PassResetTokenModel.create({ owner: user._id, token });

  const passResetLink = `${PASSWORD_RESET_LINK}?id=${user._id}&token=${token}`;
  mail.sendPasswordResetLink(user.email, passResetLink);

  res.json({ message: "Hãy kiểm tra hồm thư của bạn!" });
};

export const grantValid: RequestHandler = async (req, res) => {
  res.json({ valid: true });
};

export const updatePassword: RequestHandler = async (req, res) => {
  const { id, password } = req.body;
  const user = await UserModel.findById(id);

  if (!user) return sendErrorRes(res, "Yêu cầu không hợp lê!", 403);

  const matched = await user.comparePassword(password);

  if (matched)
    return sendErrorRes(res, "Mật khẩu này đã được sử dụng trước đó!", 422);

  user.password = password;
  await user.save();

  await PassResetTokenModel.findOneAndDelete({ owner: user._id });

  await mail.sendPasswordUpdateMessage(user.email);
  res.json({ message: "Mật khẩu đã được đặt lại" });
};

export const updateProfile: RequestHandler = async (req, res) => {
  const { name } = req.body;
  if (typeof name !== "string" || name.trim().length < 3) {
    return sendErrorRes(res, "Tên không hợp lệ", 422);
  }

  await UserModel.findByIdAndUpdate(req.user.id, { name });

  res.json({ profile: { ...req.user, name } });
};

export const updateAvatar: RequestHandler = async (req, res) => {
  const { avatar } = req.files;
  if (Array.isArray(avatar)) {
    return sendErrorRes(res, "Chỉ có thể tải lên 1 file!", 422);
  }

  if (!avatar.mimetype?.startsWith("image")) {
    return sendErrorRes(res, "File ảnh tải lên không hợp lệ!", 422);
  }

  const user = await UserModel.findById(req.user.id);
  if (!user) {
    return sendErrorRes(res, "Không tìm thấy user!", 404);
  }

  if (user.avatar?.id) {
    await cloudUploader.destroy(user.avatar.id);
  }

  const { secure_url: url, public_id: id } = await cloudUploader.upload(
    avatar.filepath,
    {
      width: 300,
      height: 300,
      crop: "thumb",
      gravity: "face",
    }
  );

  user.avatar = { url, id };
  await user.save();

  res.json({ profile: { ...req.user, avatar: user.avatar.url } });
};
export const sendPublicProfile: RequestHandler = async (req, res) => {
  const profileId = req.params.id;
  if (!isValidObjectId(profileId)) {
    return sendErrorRes(res, "Id hồ sơ không khả dụng!", 422);
  }

  const user = await UserModel.findById(profileId);

  if (!user) {
    return sendErrorRes(res, "Không tìm thấy user!", 404);
  }

  res.json({
    profile: {
      id: user._id,
      name: user.name,
      avatar: user.avatar?.url,
      address: user?.address,
    },
  });
};
