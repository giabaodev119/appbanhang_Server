import cron from "node-cron";
import ProductModel from "models/product";
import moment from "moment";

cron.schedule("0 0 * * *", async () => {
  const thresholdDate = moment().subtract(1, "days").toDate();
  try {
    // Xóa các sản phẩm cũ hơn 30 ngày
    const result = await ProductModel.deleteMany({
      createdAt: { $lt: thresholdDate },
    });
    console.log(`Đã xóa ${result.deletedCount} sản phẩm cũ.`);
  } catch (error) {
    console.error("Lỗi khi xóa sản phẩm cũ:", error);
  }
});
