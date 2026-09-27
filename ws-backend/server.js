import { WebSocketServer } from "ws";
import { PORT } from "./src/config/constants.js";
import { messageRouter } from "./src/router/messageRouter.js";
import { onClose } from "./src/lifecycle/onClose.js";

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (socket) => {
    socket.send(JSON.stringify("connected"));
    socket.on("message", (msg) => messageRouter(socket, msg));
    socket.on("close", () => onClose(socket));
});
