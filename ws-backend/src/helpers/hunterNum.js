export function hunterNum(size) {
    if (size > 1 && size < 6) {
        return 1;
    }
    if (size >= 6 && size < 10) {
        return 2;
    }
    return 0;
}
