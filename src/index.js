import app from "./app.js";
// import { config } from "dotenv";
import http from "http";
// config();
import pinata from "./DB/pinata.js";

const server = http.createServer(app);
const PORT = process.env.PORT ?? 8000;

server.listen(PORT, async () => {
  await pinata.testAuthentication().then((val) => {
    console.log(val.message);
  });
  console.log("app is listening on PORT ", PORT);
});
