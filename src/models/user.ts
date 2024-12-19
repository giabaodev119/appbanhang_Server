import { hash, compare, genSalt } from "bcrypt";
import { model, Schema, Document } from "mongoose";
import subcriptions from "src/utils/subcriptions";

export interface UserDocument extends Document {
  name: string;
  email: string;
  password: string;
  verified: boolean;
  tokens: string[];
  avatar?: { url: string; id: string };
  address?: string;
  isAdmin: boolean;
  isActive: boolean;
  phoneNumber: string;
  premiumStatus?: {
    subscription: String;
    registeredAt: Date | null;
    expiresAt: Date | null;
    isAvailable: boolean;
  };
  createdAt: Date; // Thêm trường createdAt
}

interface Methods {
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument, {}, Methods>(
  {
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      //required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    address: {
      type: String,
    },
    tokens: [String],
    avatar: {
      type: Object,
      url: String,
      id: String,
    },
    premiumStatus: {
      subscription: { type: String, enum: [...subcriptions] },
      registeredAt: { type: Date },
      expiresAt: { type: Date },
      isAvailable: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await genSalt(10);
    this.password = await hash(this.password, salt);
  }

  next();
});

userSchema.methods.comparePassword = async function (password) {
  return await compare(password, this.password);
};

userSchema.pre("save", function (next) {
  if (this.premiumStatus && this.premiumStatus.expiresAt) {
    this.premiumStatus.isAvailable = new Date() < this.premiumStatus.expiresAt;
  }
  next();
});

const UserModel = model("User", userSchema);
export default UserModel;
