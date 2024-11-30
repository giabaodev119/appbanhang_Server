import nodemailer from "nodemailer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const transport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587, // Cổng chính xác cho Gmail
  secure: false, // Sử dụng STARTTLS
  auth: {
    user: process.env.GMAIL,
    pass: process.env.GMAIL_PASS,
  },
});

const sendVerification = async (email: string, link: string) => {
  try {
    const filePath = path.resolve(
      __dirname,
      "../../src/public/Mail/mail-verify.html"
    );

    // Kiểm tra file có tồn tại
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return;
    }

    // Đọc file HTML
    let htmlContent = fs.readFileSync(filePath, "utf-8");
    htmlContent = htmlContent.replace("{{verify_link}}", link);
    await transport.sendMail({
      from: process.env.GMAIL,
      to: email,
      subject: "XÁC THỰC TÀI KHOẢN",
      html: htmlContent,
    });
    console.log("Email sent successfully!");
  } catch (err) {
    console.error("Error sending email:", err);
  }
};

const sendPasswordResetLink = async (email: string, link: string) => {
  try {
    const filePath = path.resolve(
      __dirname,
      "../../src/public/Mail/reset-pass.html"
    );

    // Kiểm tra file có tồn tại
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return;
    }

    // Đọc file HTML
    let htmlContent = fs.readFileSync(filePath, "utf-8");
    htmlContent = htmlContent.replace("{{reset_link}}", link);
    await transport.sendMail({
      from: process.env.GMAIL,
      to: email,
      subject: "XÁC NHẬN THAY ĐỔI MẬT KHẨU",
      html: htmlContent,
    });
    console.log("Email sent successfully!");
  } catch (err) {
    console.error("Error sending email:", err);
  }
};

const sendPasswordUpdateMessage = async (email: string) => {
  try {
    const filePath = path.resolve(
      __dirname,
      "../../src/public/Mail/message_success.html"
    );

    // Kiểm tra file có tồn tại
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return;
    }

    // Đọc file HTML
    let htmlContent = fs.readFileSync(filePath, "utf-8");
    await transport.sendMail({
      from: process.env.GMAIL,
      to: email,
      subject: "Đổi mật khẩu thành công",
      html: htmlContent,
    });
    console.log("Email sent successfully!");
  } catch (err) {
    console.error("Error sending email:", err);
  }
};
const mail = {
  sendVerification,
  sendPasswordResetLink,
  sendPasswordUpdateMessage,
};

export default mail;
