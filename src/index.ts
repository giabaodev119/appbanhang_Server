import "dotenv/config";
import "express-async-errors";
import "src/db";
import express from "express";
import authRouter from "routes/auth";
import formidable from "formidable";
import path from "path";
import http from "http";
import productRouter from "routes/product";
import { sendErrorRes } from "./utils/helper";
import { Server } from "socket.io";
import { TokenExpiredError, verify } from "jsonwebtoken";
import morgan from "morgan";
import conversationRouter from "./routes/conversation";
import ConversationModel from "./models/conversation";
import { updateSeenStatus } from "./controllers/conversation";
import adminRouter from "./routes/admin";
import { UploadApiResponse } from "cloudinary";
import cloudUploader from "./cloud";
import paymentRouter from "./routes/payment";
import "./controllers/productCleanupJob";
import "./utils/updatePremiumStatus";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: "/socket-message",
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(morgan("dev"));
app.use(express.static("src/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//API Routes
app.use("/auth", authRouter);
app.use("/product", productRouter);
app.use("/admin", adminRouter);
app.use("/conversation", conversationRouter);
app.use("/order", paymentRouter);

//SOCKET IO
io.use((socket, next) => {
  const socketReq = socket.handshake.auth as { token: string } | undefined;
  if (!socketReq?.token) {
    return next(new Error("Yêu câu không hợp lệ!"));
  }
  try {
    socket.data.jwtDecode = verify(socketReq.token, process.env.JWT_SECRET!);
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return next(new Error("jwt expried"));
    }
    return next(new Error("Token không hợp lệ!"));
  }
  next();
});

type MessageProfile = {
  id: string;
  name: string;
  avatar?: string;
};

type IncomingMessage = {
  message: {
    id: string;
    time: string;
    text: string;
    user: MessageProfile;
  };
  to: string;
  conversationId: string;
};

type OutgoingMessageResponse = {
  message: {
    id: string;
    time: string;
    text: string;
    user: MessageProfile;
    viewed: boolean;
  };
  from: {
    id: string;
    name: string;
    avatar?: string;
  };
  conversationId: string;
};

type SeenData = {
  messageId: string;
  peerId: string;
  conversationId: string;
};

io.on("connection", (socket) => {
  const socketData = socket.data as { jwtDecode: { id: string } };
  const userId = socketData.jwtDecode.id;

  // Tham gia room theo userId
  socket.join(userId);

  const uploadImage = (filePath: string): Promise<UploadApiResponse> => {
    return cloudUploader.upload(filePath, {
      width: 1000,
      height: 1000,
      crop: "fill",
    });
  };
  // Xử lý gửi tin nhắn mới
  socket.on("chat:new", async (data: IncomingMessage) => {
    try {
      const { conversationId, to, message } = data;

      if (!conversationId || !to || !message) {
        throw new Error("Invalid chat:new data");
      }

      await ConversationModel.findByIdAndUpdate(conversationId, {
        $push: {
          chats: {
            sentBy: message.user.id,
            content: message.text,
            timestamp: message.time,
          },
        },
      });

      const messageResponse: OutgoingMessageResponse = {
        from: {
          id: message.user.id,
          name: message.user.name,
        },
        conversationId,
        message: { ...message, viewed: false },
      };

      io.to(to).emit("chat:message", messageResponse);
    } catch (error) {
      console.error("Error handling chat:new:", error);
    }
  });
  const lockMap = new Map<string, boolean>(); // Map lưu trạng thái khóa theo conversationId

  socket.on("chat:image", async (data: IncomingMessage) => {
    const { conversationId, to, message } = data;

    if (!conversationId || !to || !message) {
      console.error("Invalid chat:new data");
      return;
    }

    // Kiểm tra khóa
    if (lockMap.get(conversationId)) {
      return;
    }

    // Đặt khóa
    lockMap.set(conversationId, true);

    try {
      const conversation = await ConversationModel.findById(conversationId);

      const isDuplicate = conversation?.chats.some((chat) => {
        const isSameContent = chat.content === message.text;
        const isSameTime =
          Math.abs(
            chat.timestamp.getTime() - new Date(message.time).getTime()
          ) < 1000; // Sai số dưới 1 giây
        const isSameSender = chat.sentBy.toString() === message.user.id;

        return isSameContent && isSameTime && isSameSender;
      });

      if (isDuplicate) {
        return;
      }

      await ConversationModel.findByIdAndUpdate(conversationId, {
        $push: {
          chats: {
            sentBy: message.user.id,
            content: message.text,
            timestamp: message.time,
          },
        },
      });

      const messageResponse: OutgoingMessageResponse = {
        from: {
          id: message.user.id,
          name: message.user.name,
        },
        conversationId,
        message: { ...message, viewed: false },
      };

      io.to(to).emit("chat:image", messageResponse);
    } catch (error) {
      console.error("Error handling chat:image:", error);
    } finally {
      // Giải phóng khóa
      lockMap.delete(conversationId);
    }
  });

  // Xử lý trạng thái đã xem
  socket.on(
    "chat:seen",
    async ({ conversationId, messageId, peerId }: SeenData) => {
      try {
        await updateSeenStatus(peerId, conversationId);
        io.to(peerId).emit("chat:seen", { conversationId, messageId });
      } catch (error) {
        console.error("Error handling chat:seen:", error);
      }
    }
  );

  // Xử lý trạng thái đang nhập tin nhắn
  socket.on("chat:typing", (typingData: { to: string; active: boolean }) => {
    io.to(typingData.to).emit("chat:typing", { typing: typingData.active });
    console.log(typingData);
  });
});

app.post("/upload-file", async (req, res) => {
  const form = formidable({
    uploadDir: path.join(__dirname, "public"),
    filename(name, ext, part, form) {
      return Date.now() + "_" + part.originalFilename;
    },
  });
  await form.parse(req);
  res.send("ok");
});

app.use(function (err, req, res, next) {
  res.status(500).json({ message: err.message });
} as express.ErrorRequestHandler);

app.use("*", (req, res) => {
  sendErrorRes(res, "Not Found!", 404);
});

server.listen(8000, () => {
  console.log("The app is running on http://localhost:8000");
});
