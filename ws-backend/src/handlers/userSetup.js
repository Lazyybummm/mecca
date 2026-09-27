import { idtoSocket, ingameState } from "../state/stores.js";

export function handleUserSetup(socket, payload) {
    const userName = payload.data.userName;
    if (idtoSocket.get(userName)) {
        socket.send(JSON.stringify({
            message: 'user setup complete'
        }));
        return;
    }
    idtoSocket.set(userName, socket);
    ingameState.set(userName, {
        userName: userName,
        roomId: null,
        role: null,
        pose: 'Stand',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        color: null,
        caught: false,
        connected: true,
    });
    socket.send(JSON.stringify('user setup is complete'));
}
