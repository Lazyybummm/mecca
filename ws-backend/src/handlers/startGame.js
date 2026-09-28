import { rooms, roomStates, idtoSocket, roomAdmins, ingameState } from "../state/stores.js";
import { selectHunters } from "../helpers/selectHunters.js";
import { cron } from "../helpers/cron.js";
import { HIDE_DURATION, ROUND_DURATION, MIN_PLAYERS } from "../config/constants.js";

export function handleStartGame(socket, payload) {
    const senderuserName = payload.data.userName;
    const roomId = payload.data.roomId;
    const hostName = roomAdmins.get(roomId);
    const rsCheck = roomStates.get(roomId);
    if (rsCheck && rsCheck.phase != 'lobby' && rsCheck.phase != 'created') {
        socket.send(JSON.stringify({ event: 'error', message: 'round already running' }));
        return;
    }
    if (hostName == senderuserName) {
        const roomLength = rooms.get(roomId).size;
        if (roomLength < MIN_PLAYERS) {
            socket.send(JSON.stringify({
                event: 'player limit',
                message: 'not enough participants'
            }));
            return;
        }
        const { hunters, hiders } = selectHunters(roomLength, roomId);
        for (const a of hunters) {
            const sock = idtoSocket.get(a);
            const st = ingameState.get(a);
            if (st) { st.role = 'hunter'; st.caught = false; st.pose = 'Stand'; st.color = null; st.position = { x: 0, y: 0, z: 0 }; st.rotation = 0; }
            sock.send(JSON.stringify({
                event: 'game-started',
                role: 'hunter'
            }));
        }

        for (const b of hiders) {
            const sock = idtoSocket.get(b);
            const st = ingameState.get(b);
            if (st) { st.role = 'hider'; st.caught = false; st.pose = 'Stand'; st.color = null; st.position = { x: 0, y: 0, z: 0 }; st.rotation = 0; }
            sock.send(JSON.stringify({
                event: 'game-started',
                role: 'hider'
            }));
        }

        roomStates.set(roomId, {
            phase: 'hide',
            startedAt: Date.now(),

            hunters: [...hunters],
            hiders: [...hiders],
            hunterSet: new Set(hunters),
            hiderSet: new Set(hiders),

            remainingHiders: hiders.length,
            caught: new Set(),

            positions: {},
            poses: {},

            hideTimer: null,
            seekTimer: null,
        });

        cron(roomId, 'seek-phase', HIDE_DURATION);
        cron(roomId, 'round-end', ROUND_DURATION);
    } else {
        socket.send(JSON.stringify('only host can perform this action'));
        return;
    }
}
