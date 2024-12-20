import { RequestHandler } from "express";
import moment from "moment";
import { sendErrorRes } from "src/utils/helper";
import InvoiceModel from "src/models/Invoice";
import UserModel from "src/models/user";

const subscriptions = new Map<string, number>([
  ["HV_1M", 1],
  ["HV_3M", 3],
  ["HV_6M", 6],
  ["HV_12M", 12],
]);

const sortObject = (obj: any) => {
  let sorted: { [key: string]: string } = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
};

const extractOrderInfo = (input: string, prefix: string): string => {
  const decodedInput = decodeURIComponent(input);

  // Define the prefix

  // Remove prefix and extract the remaining part
  const result = decodedInput.startsWith(prefix)
    ? decodedInput.substring(prefix.length)
    : decodedInput;
  return result;
};

// This is a GET method to render the create payment page
export const createPaymentPage: RequestHandler = async (req, res, next) => {
  // render order page
  res.render("order", { title: "Tạo mới đơn hàng", amount: 10000 });
};

// This is a POST method to create a payment URL
export const createPaymentUrl: RequestHandler = async (req, res, next) => {
  try {
    const ipAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const date = new Date();
    let createDate = moment(date).format("YYYYMMDDHHmmss");
    let userid = req.body.userId;
    let orderId = moment(date).format("DDHHmmss");

    // const tmnCode = config.get<string>("vnp_TmnCode");
    const tmnCode = "2EK96NL4";
    // const secretKey = config.get<string>("vnp_HashSecret");
    const secretKey = "KXOK5KH6156GNEUSMKOZD2C9Z3REQ8MZ";
    // let vnpUrl = config.get<string>("vnp_Url");
    let vnpUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    // const returnUrl = config.get<string>("vnp_ReturnUrl");
    const returnUrl = "http://10.0.130.246:8000/order/vnpay_return";

    let amount = req.body.amount;
    let bankCode = req.body.bankCode;

    let planName = req.body.planName;

    let locale = req.body.language;
    if (locale === null || locale === "") {
      locale = "vn";
    }
    let currCode = "VND";
    let vnp_Params: any = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = tmnCode;
    vnp_Params["vnp_Locale"] = locale;
    vnp_Params["vnp_CurrCode"] = currCode;
    vnp_Params["vnp_TxnRef"] = orderId;
    vnp_Params["vnp_OrderInfo"] =
      "Thanh toan cho ma GD:" + planName + "_" + userid;
    vnp_Params["vnp_OrderType"] = "other";
    vnp_Params["vnp_Amount"] = amount * 100;
    vnp_Params["vnp_ReturnUrl"] = returnUrl;
    vnp_Params["vnp_IpAddr"] = ipAddr;
    vnp_Params["vnp_CreateDate"] = createDate;
    if (bankCode !== null && bankCode !== "") {
      vnp_Params["vnp_BankCode"] = bankCode;
    }

    vnp_Params = sortObject(vnp_Params);

    let querystring = require("qs");
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");
    let hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    vnp_Params["vnp_SecureHash"] = signed;
    vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });

    res.json({ url: vnpUrl });
    // res.redirect(vnpUrl);
  } catch (error) {
    sendErrorRes(res, "Lỗi hệ thống!", 500);
  }
};

export const vnpayReturn: RequestHandler = async (req, res, next) => {
  var vnp_Params = req.query;

  var secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  // const tmnCode = config.get<string>("vnp_TmnCode");
  const tmnCode = "2EK96NL4";
  // const secretKey = config.get<string>("vnp_HashSecret");
  const secretKey = "KXOK5KH6156GNEUSMKOZD2C9Z3REQ8MZ";

  var querystring = require("qs");
  var signData = querystring.stringify(vnp_Params, { encode: false });
  var crypto = require("crypto");
  var hmac = crypto.createHmac("sha512", secretKey);
  var signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (secureHash === signed) {
    //Kiem tra xem du lieu trong db co hop le hay khong va thong bao ket qua
    const payDateString = vnp_Params["vnp_PayDate"];
    const payDate = moment(payDateString as string, "YYYYMMDDHHmmss").toDate();

    console.log(vnp_Params);
    console.log(vnp_Params["vnp_OrderInfo"]);

    const orderInfo = vnp_Params["vnp_OrderInfo"] as string;

    const planresult = extractOrderInfo(orderInfo, "Thanh+toan+cho+ma+GD:");
    console.log(planresult);
    const parts = planresult.split("_");

    // Extract the two parts
    const plan = parts.slice(0, 2).join("_"); // "HV_1M"
    const userId = parts[2]; // "674ad5cd4db158d364485a1b"

    const rescode = vnp_Params["vnp_ResponseCode"] === "00" ? "paid" : "failed";

    // Create invoice logic here
    const invoice = {
      subscriptionName: plan,
      userId: userId,
      transactionId: vnp_Params["vnp_TxnRef"],
      amount: vnp_Params["vnp_Amount"]
        ? Number(vnp_Params["vnp_Amount"]) / 100
        : 0,
      bankCode: vnp_Params["vnp_BankCode"],
      status: rescode,
      orderinfo: orderInfo,
    };

    // Save invoice to database
    await InvoiceModel.create(invoice);

    // Update user premium status
    const user = await UserModel.findByIdAndUpdate(userId);
    if (user) {
      user.premiumStatus = {
        subscription: plan,
        registeredAt: new Date(),
        expiresAt: moment()
          .add(subscriptions.get(plan) || 0, "months")
          .toDate(),
        isAvailable: true,
      };
      await user.save();
    }

    res.render("success", { code: vnp_Params["vnp_ResponseCode"] });
  } else {
    res.render("success", { code: "97" });
  }
};
