export function makeArray<T>(items: T | T[]): T[] {
    if (items === undefined) return [];
    return (Array.isArray(items) ? items : [items]) as T[];
}