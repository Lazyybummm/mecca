import { ingameState } from "../state/stores.js";

export function handleRequestState(socket, payload) {
    const roomId = payload.data.roomId;
    const filteredData = [];
    for (const p of ingameState.values()) {
        if (p.roomId == roomId) {
            filteredData.push(p);
        }
    }
    socket.send(JSON.stringify({
        event: 'requested data',
        payload: filteredData
    }));
}
