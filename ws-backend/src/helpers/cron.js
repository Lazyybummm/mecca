import { rooms, roomStates, idtoSocket } from "../state/stores.js";
import { resetPlayerState } from "./resetPlayerState.js";

export function cron(roomId, topic, time) {
    const handle = setTimeout(() => {
        const players = rooms.get(roomId);
        let result;
        const roomInfo = roomStates.get(roomId);
        if (topic == 'room-end') {
            if (roomInfo.remainingHiders > 0) {
                result = 'hiders won';
            } else {
                result = 'hunters won';
            }
            roomInfo.phase = 'ended';
        }
        if (topic == 'seek-phase') {
            roomInfo.phase = 'seek';
        }
        for (const i of players) {
            const sock = idtoSocket.get(i);
            sock.send(JSON.stringify({
                event: topic,
                roomId: roomId,
                payload: result ? result : null
            }));
        }
        if (topic == 'room-end') {
            for (const i of players) {
                resetPlayerState(i, true);
            }
            roomInfo.phase = 'lobby';
        }
    }, time);

    const state = roomStates.get(roomId);
    if (state) {
        if (topic == 'seek-phase') state.hideTimer = handle;
        if (topic == 'room-end') state.seekTimer = handle;
    }
}
