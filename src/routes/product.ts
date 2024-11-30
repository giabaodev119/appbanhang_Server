import { Router } from "express";
import { isAuth } from "middleware/auth";
import filePaser from "middleware/fileParser";
import validate from "middleware/validator";
import {
  deleteProduct,
  deleteProductImage,
  listNewProduct,
  getProductDetail,
  updateProduct,
  getProductByCategory,
  getLatestProduct,
  getListings,
  searchProducts,
  searchByAddress,
  getByAddress,
} from "controllers/product";
import { newProductSchema } from "utils/validationSchema";

const productRouter = Router();

productRouter.post(
  "/list",
  isAuth,
  filePaser,
  validate(newProductSchema),
  listNewProduct
);

productRouter.patch(
  "/:id",
  isAuth,
  filePaser,
  validate(newProductSchema),
  updateProduct
);
productRouter.delete("/:id", isAuth, deleteProduct);
productRouter.delete("/image/:productId/:imageId", isAuth, deleteProductImage);
productRouter.get("/detail/:id", getProductDetail);
productRouter.get("/by-category/:category", getProductByCategory);
productRouter.get("/latest", getLatestProduct);
productRouter.get("/listings", isAuth, getListings);
productRouter.get("/search", isAuth, searchProducts);
productRouter.get("/search-byaddress", searchByAddress);
productRouter.get("/get-byaddress", isAuth, getByAddress);

export default productRouter;
