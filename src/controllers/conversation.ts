import { UploadApiResponse } from "cloudinary";
import { RequestHandler } from "express";
import { isValidObjectId, ObjectId, Types } from "mongoose";
import cloudUploader from "src/cloud";
import ConversationModel from "src/models/conversation";
import UserModel from "src/models/user";
import { sendErrorRes } from "src/utils/helper";

interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
}

interface Chat {
  text: string;
  time: string;
  id: string;
  viewed: boolean;
  user: UserProfile;
}

interface Conversation {
  id: string;
  chats: Chat[];
  peerProfile: { avatar?: string; name: string; id: string };
}

type PopulatedChat = {
  _id: ObjectId;
  content: string;
  timestamp: Date;
  viewed: boolean;
  sentBy: { name: string; _id: ObjectId; avatar?: { url: string } };
};

type PopulatedParticipant = {
  _id: ObjectId;
  name: string;
  avatar?: { url: string };
};
const uploadImage = (filePath: string): Promise<UploadApiResponse> => {
  return cloudUploader.upload(filePath, {
    width: 1000,
    height: 1000,
    crop: "fill",
  });
};

export const getOrCreateConversation: RequestHandler = async (req, res) => {
  const { peerId } = req.params;

  if (!isValidObjectId(peerId)) {
    return sendErrorRes(res, "Peer Id không hợp lệ!", 422);
  }

  const user = await UserModel.findById(peerId);
  if (!user) {
    return sendErrorRes(res, "Không tìm thấy người dùng!", 404);
  }

  const participants = [req.user.id, peerId];
  const participantsId = participants.sort().join("_");

  const conversation = await ConversationModel.findOneAndUpdate(
    { participantsId },
    {
      $setOnInsert: {
        participantsId,
        participants,
      },
    },
    { upsert: true, new: true }
  );
  res.json({ conversationId: conversation._id });
};
export const getConversation: RequestHandler = async (req, res) => {
  const { conversationId } = req.params;

  if (!isValidObjectId(conversationId)) {
    sendErrorRes(res, "Chat Id không hợp lệ!", 422);
  }

  const conversation = await ConversationModel.findById(conversationId)
    .populate<{ chats: PopulatedChat[] }>({
      path: "chats.sentBy",
      select: "name avatar.url",
    })
    .populate<{ participants: PopulatedParticipant[] }>({
      path: "participants",
      match: { _id: { $ne: req.user.id } },
      select: "name avatar.url",
    })
    .select(
      "sentBy chats._id chats.content chats.timestamp chats.viewed participants"
    );

  if (!conversation)
    return sendErrorRes(res, "Không tìm thấy cuộc trò chuyện", 404);

  const peerProfile = conversation.participants[0];

  const finalConversation: Conversation = {
    id: conversation._id as string,
    chats: conversation.chats.map((c) => ({
      id: c._id.toString(),
      text: c.content,
      time: c.timestamp.toISOString(),
      viewed: c.viewed,
      user: {
        id: c.sentBy._id.toString(),
        name: c.sentBy.name,
        avatar: c.sentBy.avatar?.url,
      },
    })),
    peerProfile: {
      id: peerProfile._id.toString(),
      name: peerProfile.name,
      avatar: peerProfile.avatar?.url,
    },
  };

  res.json({ conversation: finalConversation });
};

export const getLastChats: RequestHandler = async (req, res) => {
  const chats = await ConversationModel.aggregate([
    {
      $match: {
        participants: req.user.id,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "participants",
        foreignField: "_id",
        as: "participantsInfo",
      },
    },
    {
      $project: {
        _id: 0,
        id: "$_id",
        participants: {
          $filter: {
            input: "$participantsInfo",
            as: "participant",
            cond: { $ne: ["$$participant._id", req.user.id] },
          },
        },
        lastChat: {
          $slice: ["$chats", -1],
        },
        unreadChatCounts: {
          $size: {
            $filter: {
              input: "$chats",
              as: "chat",
              cond: {
                $and: [
                  { $eq: ["$$chat.viewed", false] },
                  { $ne: ["$$chat.sentBy", req.user.id] },
                ],
              },
            },
          },
        },
      },
    },
    {
      $unwind: "$participants",
    },
    {
      $unwind: "$lastChat",
    },
    {
      $project: {
        id: "$id",
        lastMessage: "$lastChat.content",
        timestamp: "$lastChat.timestamp",
        unreadChatCounts: "$unreadChatCounts",
        peerProfile: {
          id: "$participants._id",
          name: "$participants.name",
          avatar: "$participants.avatar.url",
        },
      },
    },
  ]);

  res.json({ chats });
};

export const updateSeenStatus = async (
  peerId: string,
  conversationId: string
) => {
  await ConversationModel.findByIdAndUpdate(
    conversationId,
    {
      $set: {
        "chats.$[elem].viewed": true,
      },
    },
    {
      arrayFilters: [{ "elem.sentBy": peerId }],
    }
  );
};

export const updateChatSeenStatus: RequestHandler = async (req, res) => {
  const { peerId, conversationId } = req.params;

  if (!isValidObjectId(peerId) || !isValidObjectId(conversationId))
    return sendErrorRes(res, "ConversationId hoặc PeerId không hợp lệ", 422);

  await updateSeenStatus(peerId, conversationId);
  res.json({ message: "Cập nhật thành công" });
};
// upload image file to cloudinary
export const uploadChatImage: RequestHandler = async (req, res) => {
  const { conversationId } = req.params;
  const { image } = req.files;

  // Kiểm tra ID hợp lệ
  if (!isValidObjectId(conversationId)) {
    return sendErrorRes(res, "Id cuộc trò chuyện không hợp lệ!", 422);
  }

  // Lấy file ảnh và kiểm tra hợp lệ
  const imageFile = Array.isArray(image) ? image[0] : image;
  if (!imageFile || !imageFile.mimetype?.startsWith("image")) {
    return sendErrorRes(res, "File ảnh không hợp lệ!", 422);
  }

  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) {
    return sendErrorRes(res, "Không tìm thấy cuộc trò chuyện!", 404);
  }

  try {
    // Đảm bảo upload chỉ xảy ra một lần
    const { secure_url: url, public_id: id }: UploadApiResponse =
      await cloudUploader.upload(imageFile.filepath, {
        width: 1000,
        height: 1000,
        crop: "fill",
      });

    const newChat = {
      _id: new Types.ObjectId(),
      sentBy: new Types.ObjectId(req.user.id),
      content: url,
      timestamp: new Date(),
      viewed: false,
    };

    conversation.chats.push(newChat as any);
    await conversation.save();

    res.json({
      message: "Tải ảnh lên thành công!",
      image: { url, id },
      chat: newChat,
    });
  } catch (error) {
    console.error("Lỗi upload ảnh:", error);
    return sendErrorRes(res, "Lỗi trong quá trình tải ảnh!", 500);
  }
};
