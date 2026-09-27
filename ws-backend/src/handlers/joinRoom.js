import { rooms, roomStates, idtoSocket, roomAdmins, ingameState } from "../state/stores.js";

export function handleJoinRoom(socket, payload) {
    const roomId = payload.data.roomId;
    const userName = payload.data.userName;
    if (!roomId) {
        socket.send(JSON.stringify('roomId not found'));
        return;
    }
    if (!rooms.get(roomId)) {
        rooms.set(roomId, new Set());
        roomStates.set(roomId, { phase: 'created' });
        roomAdmins.set(roomId, userName);
    }
    rooms.get(roomId).add(userName);
    const userState = ingameState.get(userName);
    if (userState) userState.roomId = roomId;
    const roomState = roomStates.get(roomId);
    if (roomState && roomState.phase == 'created' && rooms.get(roomId).size >= 2) {
        roomState.phase = 'lobby';
    }
    const currentMembers = rooms.get(roomId);
    socket.send(JSON.stringify({
        message: 'succesfully joined the room',
        payload: currentMembers
    }));
    for (const c of currentMembers) {
        const sock = idtoSocket.get(c);
        sock.send(JSON.stringify({
            message: 'a user joined',
            payload: userName
        }));
    }
}
