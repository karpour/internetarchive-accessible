export function makeArray<T>(items: T | T[]): T extends undefined ? undefined : T[] {
    if (items === undefined) return undefined as T extends undefined ? undefined : T[];
    return (Array.isArray(items) ? items : [items]) as T extends undefined ? undefined : T[];
}