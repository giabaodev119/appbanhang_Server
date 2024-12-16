import { Document, model, ObjectId, Schema } from "mongoose";

export interface InvoiceDocument extends Document {
  subscriptionName: string;
  userId: ObjectId; // Liên kết với id của User
  amount: number; // Tổng số tiền trong hóa đơn
  bankCode: string; // Mã ngân hàng
  transactionId: string; // Mã giao dịch
  orderinfo: string; // Thông tin đơn hàng
  createdAt: Date; // Ngày tạo hóa đơn
  status: "pending" | "paid" | "failed"; // Trạng thái hóa đơn
}

const invoiceSchema = new Schema<InvoiceDocument>(
  {
    subscriptionName: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      require: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    bankCode: {
      type: String,
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
    },
    orderinfo: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: "pending",
    },
  },
  { timestamps: true }
);

const InvoiceModel = model<InvoiceDocument>("Invoice", invoiceSchema);
export default InvoiceModel;
