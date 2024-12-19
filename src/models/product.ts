import { Document, model, Schema } from "mongoose";
import categories from "utils/categories";

type productImage = { url: string; id: string };

export interface ProductDocument extends Document {
  owner: Schema.Types.ObjectId;
  name: string;
  price: number;
  purchasingDate: Date;
  category: string;
  images?: productImage[];
  thumbnail?: string;
  description: string;
  address?: string;
  isActive: boolean;
  isSold: boolean;
  isFavorite: boolean;

  createdAt: Date; // Thêm trường createdAt
}

const schema = new Schema<ProductDocument>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      enum: [...categories],
      required: true,
    },
    purchasingDate: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 2592000,
    },

    address: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSold: {
      type: Boolean,
      default: false,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },

    images: [
      {
        type: Object,
        url: String,
        id: String,
      },
    ],
    thumbnail: String,
  },
  { timestamps: true }
);

const ProductModel = model("Product", schema);

export default ProductModel;
