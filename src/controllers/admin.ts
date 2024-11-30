import { RequestHandler } from "express";
import ProductModel from "models/product";
import { isValidObjectId } from "mongoose";
import UserModel from "src/models/user";
import { sendErrorRes } from "src/utils/helper";
import cloudUploader, { cloudApi } from "src/cloud";

export const getListings: RequestHandler = async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      res
        .status(403)
        .json({ success: false, message: "Bạn không có quyền truy cập" });
      return; // Thêm `return` để kết thúc hàm nhưng không trả về giá trị.
    }

    const query = {};
    const products = await ProductModel.find(query).sort("-createdAt");

    // Tạo danh sách sản phẩm với các trường cần thiết
    const listings = products.map((p) => ({
      id: p._id,
      name: p.name,
      thumbnail: p.thumbnail,
      category: p.category,
      price: p.price,
      address: p.address,
      isActive: p.isActive, // Thêm isActive
    }));

    res.status(200).json({ data: listings });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Đã xảy ra lỗi, vui lòng thử lại" });
  }
};
export const getUser: RequestHandler = async (req, res) => {
  const { pageNo = "1", limit = "10" } = req.query as {
    pageNo: string;
    limit: string;
  };

  try {
    if (!req.user?.isAdmin) {
      res
        .status(403)
        .json({ success: false, message: "Bạn không có quyền truy cập" });
      return; // Thêm `return` để kết thúc hàm nhưng không trả về giá trị.
    }

    const pageNumber = Math.max(1, parseInt(pageNo)) || 1;
    const pageLimit = Math.max(1, parseInt(limit)) || 10;

    const query = {};

    const user = await UserModel.find(query)
      .sort("-createdAt")
      .skip((pageNumber - 1) * pageLimit)
      .limit(pageLimit);

    const listings = Array.isArray(user)
      ? user.map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          address: u.address,
          isActive: u.isActive,
        }))
      : [];

    res.status(200).json({ success: true, data: listings });
  } catch (error) {
    console.error("Lỗi khi truy vấn dữ liệu:", error);
    res
      .status(500)
      .json({ success: false, message: "Đã xảy ra lỗi, vui lòng thử lại" });
  }
};

export const updateStatus: RequestHandler = async (req, res) => {
  const { isActive } = req.body;
  const productId = req.params.id;

  // Kiểm tra nếu ID sản phẩm không hợp lệ
  if (!isValidObjectId(productId)) {
    return sendErrorRes(res, "Invalid product id!", 422);
  }

  // Tìm sản phẩm và cập nhật
  const product = await ProductModel.findOneAndUpdate(
    { _id: productId },
    {
      isActive,
    },
    {
      new: true, // Trả về bản ghi đã cập nhật
    }
  );

  // Kiểm tra nếu sản phẩm không tồn tại
  if (!product) return sendErrorRes(res, "Product not found!", 404);

  await product.save();
  res.status(201).json({
    message: "Product updated successfully",
    product: {
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category,
      description: product.description,
      purchasingDate: product.purchasingDate,
      isActive: product.isActive, // Trả về trạng thái isActive
      images: product.images,
      thumbnail: product.thumbnail,
    },
  });
};
export const updateUserStatus: RequestHandler = async (req, res) => {
  const { isActive } = req.body;
  const userId = req.params.id;

  try {
    // Kiểm tra nếu ID người dùng không hợp lệ
    if (!isValidObjectId(userId)) {
      res.status(422).json({ success: false, message: "Invalid user ID!" });
      return;
    }

    // Tìm người dùng và cập nhật trạng thái
    const user = await UserModel.findOneAndUpdate(
      { _id: userId },
      { isActive },
      { new: true }
    );

    // Kiểm tra nếu người dùng không tồn tại
    if (!user) {
      res.status(404).json({ success: false, message: "User not found!" });
      return;
    }

    console.log(user.isActive);

    // Nếu người dùng bị block, xử lý sản phẩm và ảnh liên quan
    if (!user.isActive) {
      // Lấy danh sách sản phẩm và ảnh liên quan
      const products = await ProductModel.find({ owner: userId }, "images");

      if (products.length === 0) {
        res.status(404).json({ success: false, message: "No products found!" });
        return;
      }

      // Thu thập IDs của các ảnh cần xóa
      const images = products.flatMap((product) => product.images || []);
      const imageIds = images.map(({ id }) => id);

      // Xóa sản phẩm
      const result = await ProductModel.deleteMany({ owner: userId });
      console.log(`${result.deletedCount} sản phẩm đã bị xóa.`);

      // Xóa ảnh từ Cloud API nếu có
      if (imageIds.length) {
        await cloudApi.delete_resources(imageIds);
        console.log(`${imageIds.length} ảnh đã bị xóa.`);
      }
    }

    // Gửi phản hồi thành công
    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        address: user.address,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Error updating user or deleting products:", error);
    res.status(500).json({ success: false, message: "An error occurred!" });
  }
};
