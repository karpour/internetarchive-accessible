export function tryParseInt(arg: any): number {
    try {
        let page = parseInt(arg);
        if (!Number.isNaN(page)) return page;
        return 1;
    } catch (err) {
        return 1;
    }
}
