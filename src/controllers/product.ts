import { UploadApiResponse } from "cloudinary";
import { RequestHandler } from "express";
import { isValidObjectId, RootFilterQuery } from "mongoose";
import cloudUploader, { cloudApi } from "src/cloud";
import ProductModel, { ProductDocument } from "models/product";
import UserModel, { UserDocument } from "models/user";
import { sendErrorRes } from "utils/helper";
import categories from "utils/categories";
import moment from "moment";

const uploadImage = (filePath: string): Promise<UploadApiResponse> => {
  return cloudUploader.upload(filePath, {
    width: 1000,
    height: 1000,
    crop: "fill",
  });
};

export const listNewProduct: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      price,
      category,
      description,
      purchasingDate,
      provinceName,
      districtName,
    } = req.body;

    // Kiểm tra thông tin người dùng
    const user = await UserModel.findById(req.user.id); // Lấy thông tin đầy đủ từ DB
    if (!user) {
      return sendErrorRes(res, "Không thể xác thực người dùng!", 401);
    }

    // Kiểm tra trạng thái premium
    if (user.premiumStatus?.isAvailable) {
      console.log("Người dùng premium, không giới hạn đăng sản phẩm!");
    } else {
      // Kiểm tra số lượng sản phẩm đã đăng trong tháng
      const currentMonthStart = moment().startOf("month");
      const currentMonthEnd = moment().endOf("month");

      const productCountThisMonth = await ProductModel.countDocuments({
        owner: user.id,
        createdAt: {
          $gte: currentMonthStart.toDate(),
          $lt: currentMonthEnd.toDate(),
        },
      });

      if (productCountThisMonth >= 10) {
        return sendErrorRes(
          res,
          "Bạn chỉ có thể tạo tối đa 10 sản phẩm mỗi tháng!",
          403
        );
      }
    }

    // Tạo sản phẩm mới
    const address = `${provinceName}_${districtName}`;
    const newProduct = new ProductModel({
      owner: user.id,
      name,
      price,
      category,
      description,
      purchasingDate,
      address,
    });

    // Kiểm tra và upload ảnh
    const { images } = req.files;
    const isMultipleImages = Array.isArray(images);
    let invalidFileType = false;

    if (isMultipleImages && images.length > 5) {
      return sendErrorRes(res, "Chỉ có thể tải lên tối đa 5 ảnh!", 422);
    }

    if (isMultipleImages) {
      for (let img of images) {
        if (!img.mimetype?.startsWith("image")) {
          invalidFileType = true;
          break;
        }
      }
    } else {
      if (images && !images.mimetype?.startsWith("image")) {
        invalidFileType = true;
      }
    }

    if (isMultipleImages) {
      const uploadPromise = images.map((file) => uploadImage(file.filepath));
      const uploadResults = await Promise.all(uploadPromise);
      newProduct.images = uploadResults.map(({ secure_url, public_id }) => {
        return { url: secure_url, id: public_id };
      });

      newProduct.thumbnail = newProduct.images[0].url;
    } else {
      if (images) {
        const { secure_url, public_id } = await uploadImage(images.filepath);
        newProduct.images = [{ url: secure_url, id: public_id }];
        newProduct.thumbnail = secure_url;
      }
    }

    if (invalidFileType)
      return sendErrorRes(res, "File không hợp lệ, file phải là ảnh!", 422);

    await newProduct.save();
    res.status(201).json({ message: "Thêm sản phẩm mới thành công" });
  } catch (error) {
    console.error("Error creating new product:", error);
    sendErrorRes(res, "Có lỗi xảy ra khi tạo sản phẩm mới!", 500);
  }
};

export const updateProduct: RequestHandler = async (req, res) => {
  const {
    name,
    price,
    category,
    description,
    purchasingDate,
    thumbnail,
    provinceName,
    districtName,
  } = req.body;

  const address = provinceName + "_" + districtName;
  const productId = req.params.id;
  if (!isValidObjectId(productId))
    return sendErrorRes(res, "Id sản phẩm không hợp lệ!", 422);
  const product = await ProductModel.findOneAndUpdate(
    {
      _id: productId,
      owner: req.user.id,
    },
    { name, price, category, description, purchasingDate, address },
    { new: true }
  );
  if (!product) return sendErrorRes(res, "Không tìm thấy sản phẩm!", 404);

  if (typeof thumbnail === "string") product.thumbnail = thumbnail;

  const { images } = req.files;

  const isMultipleImages = Array.isArray(images);

  let invalidFileType = false;

  if (isMultipleImages) {
    const oldImages = product.images?.length || 0;
    if (oldImages + images.length > 5)
      return sendErrorRes(res, "Chỉ có thể tải lên tối đa 5 ảnh!", 422);
  }

  if (isMultipleImages) {
    for (let img of images) {
      if (!img.mimetype?.startsWith("image")) {
        invalidFileType = true;
        break;
      }
    }
  } else {
    if (images)
      if (!images.mimetype?.startsWith("image")) {
        invalidFileType = true;
      }
  }

  if (isMultipleImages) {
    const uploadPromise = images.map((file) => uploadImage(file.filepath));
    const uploadResults = await Promise.all(uploadPromise);
    const newImages = uploadResults.map(({ secure_url, public_id }) => {
      return { url: secure_url, id: public_id };
    });
    if (product.images) product.images.push(...newImages);
    else product.images = newImages;
  } else {
    if (images) {
      const { secure_url, public_id } = await uploadImage(images.filepath);
      if (product.images)
        product.images.push({ url: secure_url, id: public_id });
      else product.images = [{ url: secure_url, id: public_id }];
    }
  }

  if (invalidFileType)
    return sendErrorRes(res, "File không hợp lệ, file phải là ảnh!", 422);
  await product.save();

  res.status(201).json({ message: "Cập nhật sản phẩm thành công" });
};

export const deleteProduct: RequestHandler = async (req, res) => {
  const productId = req.params.id;
  if (!isValidObjectId(productId))
    return sendErrorRes(res, "Id sản phẩm không hợp lệ!", 422);

  const product = await ProductModel.findOneAndDelete({
    _id: productId,
    owner: req.user.id,
  });
  if (!product) return sendErrorRes(res, "Không tìm thấy sản phẩm!", 404);
  const images = product.images || [];
  if (images.length) {
    const ids = images.map(({ id }) => id);
    await cloudApi.delete_resources(ids);
  }
  res.json({ message: "Xóa sản phẩm thành công" });
};
export const deleteProductImage: RequestHandler = async (req, res) => {
  const { productId, imageId } = req.params;
  if (!isValidObjectId(productId))
    return sendErrorRes(res, "Id sản phẩm không hợp lệ!", 422);
  const product = await ProductModel.findOneAndUpdate(
    { _id: productId, owner: req.user.id },
    {
      $pull: {
        images: { id: imageId },
      },
    },
    { new: true }
  );

  if (!product) return sendErrorRes(res, "Không tìm thấy sản phẩm!", 404);

  if (product.thumbnail?.includes(imageId)) {
    const images = product.images;
    if (images) product.thumbnail = images[0].url;
    else product.thumbnail = "";
    await product.save();
  }

  await cloudUploader.destroy(imageId);

  res.json({ message: "Xóa ảnh thành công" });
};
export const getProductDetail: RequestHandler = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return sendErrorRes(res, "Id sản phẩm không hợp lệ!", 422);
  const product = await ProductModel.findById(id).populate<{
    owner: UserDocument;
  }>("owner");
  if (!product) return sendErrorRes(res, "Không tìm thấy sản phẩm", 404);

  res.json({
    product: {
      id: product._id,
      name: product.name,
      description: product.description,
      thumbnail: product.thumbnail,
      category: product.category,
      date: product.purchasingDate,
      price: product.price,
      image: product.images?.map(({ url }) => url),
      address: product.address,
      seller: {
        id: product.owner._id,
        name: product.owner.name,
        avatar: product.owner.avatar?.url,
      },
    },
  });
  console.log(product);
};

export const getProductByCategory: RequestHandler = async (req, res) => {
  const { category } = req.params;
  const { pageNo = "1", limit = "10" } = req.query as {
    pageNo: string;
    limit: string;
  };
  if (!categories.includes(category))
    return sendErrorRes(res, "Danh mục sản phẩm không hợp lệ!", 422);

  const products = await ProductModel.find({ category })
    .sort("-createdAt")
    .skip((+pageNo - 1) * +limit)
    .limit(+limit);

  const listings = products.map((p) => {
    return {
      id: p._id,
      name: p.name,
      thumbnail: p.thumbnail,
      category: p.category,
      price: p.price,
      address: p?.address,
    };
  });
  res.json({ products: listings });
};
export const getLatestProduct: RequestHandler = async (req, res) => {
  const products = await ProductModel.find().sort("-createdAt").limit(20);

  const listings = products.map((p) => {
    return {
      id: p._id,
      name: p.name,
      thumbnail: p.thumbnail,
      category: p.category,
      price: p.price,
      address: p?.address,
      isSold: p.isSold,
    };
  });
  res.json({ products: listings });
};

export const getListings: RequestHandler = async (req, res) => {
  const { pageNo = "1", limit = "20" } = req.query as {
    pageNo: string;
    limit: string;
  };

  const products = await ProductModel.find({ owner: req.user.id })
    .sort("-createdAt")
    .skip((+pageNo - 1) * +limit)
    .limit(+limit);

  const listings = products.map((p) => {
    return {
      id: p._id,
      name: p.name,
      thumbnail: p.thumbnail,
      category: p.category,
      price: p.price,
      image: p.images?.map((i) => i.url),
      date: p.purchasingDate,
      description: p.description,
      address: p.address,
      isSold: p.isSold,
      seller: {
        id: req.user.id,
        name: req.user.name,
        avatar: req.user.avatar,
      },
    };
  });
  res.json({ products: listings });
};
export const searchProducts: RequestHandler = async (req, res) => {
  const { name } = req.query;

  const filter: RootFilterQuery<ProductDocument> = {};

  if (typeof name === "string") filter.name = { $regex: new RegExp(name, "i") };

  const products = await ProductModel.find(filter).limit(50);

  res.json({
    results: products.map((product) => ({
      id: product._id,
      name: product.name,
      thumbnail: product.thumbnail,
      address: product.address,
    })),
  });
};

export const getByAddress: RequestHandler = async (req, res) => {
  const filter: RootFilterQuery<ProductDocument> = {};

  // Kiểm tra req.user có tồn tại hay không
  if (!req.user) {
    return;
  }

  const { address } = req.user;

  if (!address) {
    return;
  }

  // Tách địa chỉ theo dấu gạch dưới "_"
  const splitAddress = address.split("_");
  const city = splitAddress[0]; // Lấy phần thành phố (phần đầu tiên)

  if (city) {
    // Tìm kiếm theo thành phố với regex không phân biệt chữ hoa/chữ thường
    filter.address = { $regex: new RegExp(`^${city}`, "i") };
  } else {
    sendErrorRes(res, "Địa chỉ không hợp lệ!", 400);
    return;
  }

  try {
    // Tìm sản phẩm theo bộ lọc
    const products = await ProductModel.find(filter).limit(50);

    res.json({
      results: products.map((product) => ({
        id: product._id,
        name: product.name,
        address: product.address,
        thumbnail: product?.thumbnail,
        category: product.category,
        price: product.price,
        isSold: product.isSold,
      })),
    });
  } catch (error) {
    sendErrorRes(res, "Lỗi hệ thống!", 500);
  }
};

export const searchByAddress: RequestHandler = async (req, res) => {
  try {
    const { ProvinceName, DistrictName } = req.query;

    if (!ProvinceName) {
      sendErrorRes(res, "ProvinceName is required.", 400);
      return; // Không trả về giá trị, chỉ kết thúc hàm.
    }

    let addressRegex: RegExp;
    if (DistrictName) {
      addressRegex = new RegExp(`^${ProvinceName}_${DistrictName}$`, "i");
    } else {
      addressRegex = new RegExp(`^${ProvinceName}_(.*)$`, "i");
    }

    const results = await ProductModel.find({
      address: { $regex: addressRegex },
    }).limit(50);

    res.json({
      results: results.map((item) => ({
        id: item._id,
        name: item.name,
        address: item.address,
        thumbnail: item?.thumbnail,
        category: item.category,
        price: item.price,
      })),
    });
    return; // Đảm bảo không trả về giá trị nào.
  } catch (error) {
    sendErrorRes(res, "An error occurred while searching.", 500);
    return; // Kết thúc hàm.
  }
};
export const getSeller: RequestHandler = async (req, res) => {
  try {
    const { id } = req.query;

    // Kiểm tra tham số đầu vào
    if (!id) {
      sendErrorRes(res, "sellerId is required.", 400);
      return;
    }

    // Tìm thông tin người bán
    const owner = await UserModel.findById(id).select(
      "name email avatar address isAdmin isActive createdAt updatedAt"
    );

    if (!owner) {
      sendErrorRes(res, "Seller not found.", 404);
      return;
    }

    // Tìm tất cả sản phẩm thuộc về người bán này
    const products = await ProductModel.find({
      owner: id,
      isActive: true,
    }).select("name price category thumbnail address description");

    // Trả về kết quả
    res.json({
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        avatar: owner.avatar?.url,
        address: owner.address,
        isAdmin: owner.isAdmin,
        isActive: owner.isActive,
        createdAt: owner.createdAt,
      },
      products: products.map((product) => ({
        id: product._id,
        name: product.name,
        price: product.price,
        category: product.category,
        thumbnail: product.thumbnail,
        address: product.address,
        description: product.description,
      })),
    });
  } catch (error) {
    sendErrorRes(
      res,
      "An error occurred while retrieving seller information.",
      500
    );
  }
};
export const markProductAsSold: RequestHandler = async (req, res) => {
  try {
    const productId = req.params.id; // Lấy ID sản phẩm
    const { isSold } = req.body; // Trạng thái isSold

    if (!req.body || typeof isSold !== "boolean") {
      return sendErrorRes(
        res,
        "Dữ liệu không hợp lệ! Trường 'isSold' phải là kiểu boolean.",
        400
      );
    }

    const userId = req.user?.id; // ID người dùng hiện tại
    if (!userId) {
      return sendErrorRes(
        res,
        "Bạn cần đăng nhập để thực hiện hành động này!",
        401
      );
    }

    // Tìm sản phẩm và cập nhật
    const updatedProduct = await ProductModel.findOneAndUpdate(
      { _id: productId, owner: userId },
      { isSold },
      { new: true }
    ).lean(); // Trả về object JS thông thường

    if (!updatedProduct) {
      return sendErrorRes(
        res,
        "Sản phẩm không tồn tại hoặc bạn không có quyền thay đổi trạng thái!",
        404
      );
    }

    res.status(200).json({
      message: `Sản phẩm đã được đánh dấu là ${
        isSold ? "đã bán" : "chưa bán"
      } thành công!`,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái sản phẩm:", error);
    sendErrorRes(res, "Lỗi máy chủ, vui lòng thử lại sau!", 500);
  }
};
