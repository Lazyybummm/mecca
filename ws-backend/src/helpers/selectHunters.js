import { rooms } from "../state/stores.js";
import { hunterNum } from "./hunterNum.js";

export function selectHunters(size, roomId) {
    let hunterCount = hunterNum(size);
    const hunterArray = [];
    const currentPlayers = rooms.get(roomId);
    const currentArray = [...currentPlayers];
    while (hunterCount != 0 && currentArray.length > 0) {
        const randIndex = Math.floor(Math.random() * currentArray.length);
        const element = currentArray[randIndex];
        currentArray.splice(randIndex, 1);
        hunterArray.push(element);
        hunterCount--;
    }
    return { hunters: hunterArray, hiders: currentArray };
}
