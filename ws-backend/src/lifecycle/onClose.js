import { rooms, idtoSocket, ingameState } from "../state/stores.js";

export function onClose(socket) {
    let foundUser = null;
    for (const [name, sock] of idtoSocket) {
        if (sock === socket) { foundUser = name; break; }
    }
    if (!foundUser) return;
    const state = ingameState.get(foundUser);
    if (state) state.connected = false;
    idtoSocket.delete(foundUser);
    if (state && state.roomId) {
        const room = rooms.get(state.roomId);
        if (room) {
            room.delete(foundUser);
            for (const p of room) {
                const sock = idtoSocket.get(p);
                if (sock) sock.send(JSON.stringify({
                    event: 'player-left',
                    userName: foundUser
                }));
            }
        }
    }
}
