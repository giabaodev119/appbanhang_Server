import { Router } from "express";
import {
  getConversation,
  getLastChats,
  getOrCreateConversation,
  updateChatSeenStatus,
  uploadChatImage,
} from "src/controllers/conversation";
import { isAuth } from "src/middleware/auth";
import filePaser from "src/middleware/fileParser";

const conversationRouter = Router();

conversationRouter.get("/with/:peerId", isAuth, getOrCreateConversation);
conversationRouter.get("/chats/:conversationId", isAuth, getConversation);
conversationRouter.get("/last-chats", isAuth, getLastChats);
conversationRouter.patch(
  "/seen/:conversationId/:peerId",
  isAuth,
  updateChatSeenStatus
);
conversationRouter.post(
  "/:conversationId/upload-image",
  isAuth,
  filePaser,
  uploadChatImage
);

export default conversationRouter;
