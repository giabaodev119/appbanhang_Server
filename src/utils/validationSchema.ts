import { isValidObjectId } from "mongoose";
import * as yup from "yup";
import categories from "./categories";
import { parseISO } from "date-fns";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

yup.addMethod(yup.string, "email", function validateEmail(message) {
  return this.matches(emailRegex, {
    message,
    name: "email",
    excludeEmptyString: true,
  });
});

const password = {
  password: yup
    .string()
    .required("Mật khẩu không được để trống!")
    .min(8, "Mật khẩu nên có ít nhất 8 kí tự!")
    .matches(passwordRegex, "Mật khẩu quá dễ đoán."),
};

export const newUserSchema = yup.object({
  name: yup.string().required("Tên không được để trống!"),
  email: yup
    .string()
    .email("Email không hợp lệ!")
    .required("Email không được để trống!"),
  ...password,
});

const tokenAndId = {
  id: yup.string().test({
    name: "valid-id",
    message: "User id không hợp lệ",
    test: (value) => {
      return isValidObjectId(value);
    },
  }),
  token: yup.string().required("Token không được để trống!"),
};

export const verifyTokenSchema = yup.object({
  ...tokenAndId,
});

export const resetPassSchema = yup.object({
  ...tokenAndId,
  ...password,
});

export const newProductSchema = yup.object({
  name: yup.string().required("Tên không được để trống!"),
  description: yup.string().required("Mô tả không được để trống!"),
  category: yup
    .string()
    .oneOf(categories, "Danh mục không hợp lệ")
    .required("Danh mục không được để trống!"),
  price: yup
    .string()
    .transform((value) => {
      if (isNaN(+value)) return "";
      return +value;
    })
    .required("Giá không được để trống!"),
  purchasingDate: yup
    .string()
    .transform((value) => {
      try {
        return parseISO(value);
      } catch (error) {
        return "";
      }
    })
    .required("Ngày mua sản phẩm không được để trống!"),
});
