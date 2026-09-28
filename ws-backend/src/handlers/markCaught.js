import { rooms, roomStates, idtoSocket, ingameState } from "../state/stores.js";
import { resetPlayerState } from "../helpers/resetPlayerState.js";

export function handleMarkCaught(socket, payload) {
    const roomId = payload.data.roomId;
    const senderUsername = payload.data.senderUsername;
    const targetUsername = payload.data.targetUsername;
    const roomInfo = roomStates.get(roomId);
    if (!roomInfo.hunterSet.has(senderUsername) || !roomInfo.hiderSet.has(targetUsername)) {
        socket.send(JSON.stringify({
            event: 'not authorized',
            message: 'not authorized to perform this action'
        }));
        return;
    }
    roomInfo.caught.add(targetUsername);
    roomInfo.remainingHiders = roomInfo.remainingHiders - 1;
    const targetState = ingameState.get(targetUsername);
    if (targetState) targetState.caught = true;
    const players = rooms.get(roomId);
    for (const p of players) {
        const sock = idtoSocket.get(p);
        sock.send(JSON.stringify({
            event: 'player caught',
            hunter: senderUsername,
            hider: targetUsername
        }));
    }

    if (roomInfo.remainingHiders === 0) {
        if (roomInfo.seekTimer) {
            clearTimeout(roomInfo.seekTimer);
            roomInfo.seekTimer = null;
        }
        roomInfo.phase = 'ended';
        for (const p of players) {
            const sock = idtoSocket.get(p);
            sock.send(JSON.stringify({
                event: 'room-end',
                roomId: roomId,
                payload: 'hunters won'
            }));
        }
        for (const p of players) {
            resetPlayerState(p, true);
        }
        roomInfo.phase = 'lobby';
    }
}
