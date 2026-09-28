import { handleUserSetup } from "../handlers/userSetup.js";
import { handleJoinRoom } from "../handlers/joinRoom.js";
import { handleMovement } from "../handlers/movement.js";
import { handleStartGame } from "../handlers/startGame.js";
import { handleMarkCaught } from "../handlers/markCaught.js";
import { handleChangedPose } from "../handlers/changedPose.js";
import { handleRequestState } from "../handlers/requestState.js";
import { handleLeaveRoom } from "../handlers/leaveRoom.js";

const handlers = {
    "user-setup": handleUserSetup,
    "join-room": handleJoinRoom,
    "movement": handleMovement,
    "start-game": handleStartGame,
    "mark-caught": handleMarkCaught,
    "changed-pose": handleChangedPose,
    "request-state": handleRequestState,
    "leave-room": handleLeaveRoom,
};

export function messageRouter(socket, msg) {
    const payload = JSON.parse(msg);
    const handler = handlers[payload.type];
    if (handler) handler(socket, payload);
}
