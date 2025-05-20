
/**
 * Never-fail parseInt method. Tries to parse whatever is provided as an integer, returns 1 by default
 * @param arg Integer string
 * @returns parsed integer or `1`
 */
export function tryParseInt(arg: any): number {
    try {
        let page = parseInt(arg);
        if (!Number.isNaN(page)) return page;
        return 1;
    } catch (err) {
        return 1;
    }
}
