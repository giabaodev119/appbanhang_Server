import { connect } from "mongoose";

const uri = "mongodb://localhost:27017/apptest";
connect(uri)
  .then(() => {
    console.log("db connect successfully");
  })
  .catch((err) => {
    console.log("db connect error: ", err.message);
  });
