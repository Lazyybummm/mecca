import { rooms, idtoSocket, ingameState } from "../state/stores.js";

export function handleMovement(socket, payload) {
    const roomId = payload.data.roomId;
    const players = rooms.get(roomId);
    if (!players) return;
    const userName = payload.data.userName;
    const userState = ingameState.get(userName);
    if (userState && payload.data.coordinates) {
        userState.position = {
            x: payload.data.coordinates.x,
            y: payload.data.coordinates.y,
            z: payload.data.coordinates.z
        };
        userState.rotation = payload.data.coordinates.ry || 0;
        if (payload.data.coordinates.col) userState.color = payload.data.coordinates.col;
    }
    for (const p of players) {
        const sock = idtoSocket.get(p);
        sock.send(JSON.stringify({
            message: 'a player moved',
            payload: payload.data.coordinates
        }));
    }
}
