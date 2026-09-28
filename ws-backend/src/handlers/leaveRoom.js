import { rooms, roomStates, idtoSocket, ingameState } from "../state/stores.js";
import { resetPlayerState } from "../helpers/resetPlayerState.js";

export function handleLeaveRoom(socket, payload) {
    const roomId = payload.data.roomId;
    const userName = payload.data.userName;
    const roomState = roomStates.get(roomId);
    const userState = ingameState.get(userName);
    if (!userState) return;

    if (roomState.phase == 'lobby') {
        rooms.get(roomId).delete(userName);
        resetPlayerState(userName, false);
        const currentMembers = rooms.get(roomId);
        for (const p of currentMembers) {
            const sock = idtoSocket.get(p);
            sock.send(JSON.stringify({
                event: 'user left',
                userName: userName
            }));
        }
        return;
    }

    if (roomState.phase == 'seek' || roomState.phase == 'hide') {
        rooms.get(roomId).delete(userName);
        if (userState.role == 'hider') {
            roomState.remainingHiders = roomState.remainingHiders - 1;
            roomState.hiders = roomState.hiders.filter(c => c != userName);
            roomState.hiderSet.delete(userName);
            if (roomState.remainingHiders == 0) {
                roomState.phase = 'ended';
                resetPlayerState(userName, false);
                const currentMembers = rooms.get(roomId);
                for (const p of currentMembers) {
                    const sock = idtoSocket.get(p);
                    sock.send(JSON.stringify({
                        event: 'room ended as the last hider left',
                        userName: userName
                    }));
                }
            } else {
                resetPlayerState(userName, false);
                const currentMembers = rooms.get(roomId);
                for (const p of currentMembers) {
                    const sock = idtoSocket.get(p);
                    sock.send(JSON.stringify({
                        event: 'user left',
                        userName: userName
                    }));
                }
            }
        } else {
            roomState.hunterSet.delete(userName);
            roomState.hunters = roomState.hunters.filter(c => c != userName);
            if (roomState.hunterSet.size == 0) {
                roomState.phase = 'ended';
                resetPlayerState(userName, false);
                const currentMembers = rooms.get(roomId);
                for (const p of currentMembers) {
                    const sock = idtoSocket.get(p);
                    sock.send(JSON.stringify({
                        event: 'room ended as the hunter left',
                        userName: userName
                    }));
                }
            } else {
                resetPlayerState(userName, false);
                const currentMembers = rooms.get(roomId);
                for (const p of currentMembers) {
                    const sock = idtoSocket.get(p);
                    sock.send(JSON.stringify({
                        event: 'user left',
                        userName: userName
                    }));
                }
            }
        }
    }
}
