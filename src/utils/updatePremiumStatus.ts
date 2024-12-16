import cron from "node-cron";
import UserModel from "../models/user";

// Schedule the job to run every day at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    const users = await UserModel.find({
      "premiumStatus.expiresAt": { $ne: null },
    });

    for (const user of users) {
      if (
        user.premiumStatus?.expiresAt &&
        user.premiumStatus.expiresAt < new Date()
      ) {
        user.premiumStatus.isAvailable = false;
        user.premiumStatus.expiresAt = null;
        user.premiumStatus.registeredAt = null;
        user.premiumStatus.subscription = "";
        await user.save();
      }
    }

    console.log("Premium status updated for expired users");
  } catch (error) {
    console.error("Error updating premium status:", error);
  }
});
