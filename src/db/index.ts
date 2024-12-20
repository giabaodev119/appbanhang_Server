import { connect } from "mongoose";

const uri = "mongodb://127.0.0.1:27017/app_banhang";
connect(uri)
  .then(() => {
    console.log("db connect successfully");
  })
  .catch((err) => {
    console.log("db connect error: ", err.message);
  });
