import { connect } from "mongoose";

const uri = "mongodb://localhost:27017/appbanhang";
connect(uri)
  .then(() => {
    console.log("db connect successfully");
  })
  .catch((err) => {
    console.log("db connect error: ", err.message);
  });
