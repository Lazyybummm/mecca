import { rooms, idtoSocket, ingameState } from "../state/stores.js";

export function handleChangedPose(socket, payload) {
    const userName = payload.data.userName;
    const pose = payload.data.pose;
    const currentState = ingameState.get(userName);
    if (!currentState) {
        socket.send("user not found with this username ");
        return;
    }
    currentState.pose = pose;
    const roomId = currentState.roomId;
    const players = rooms.get(roomId);
    for (const p of players) {
        const sock = idtoSocket.get(p);
        sock.send(JSON.stringify({
            event: 'pose changed ',
            userName: userName,
            pose: pose
        }));
    }
}
