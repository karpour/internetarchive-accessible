export function parseWaybackTimestamp(timestampString: string): Date {
    const RegExp_Wayback_Timestamp = /^(?<year>\d\d\d\d)(?<month>\d\d)(?<day>\d\d)(?<hour>\d\d)(?<minutes>\d\d)(?<seconds>\d\d)/;
    const r = timestampString.match(RegExp_Wayback_Timestamp);
    if (r?.groups) {
        const g = r.groups;
        return new Date(Date.UTC(
            parseInt(g.year!),
            parseInt(g.month!) - 1,
            parseInt(g.day!),
            parseInt(g.hour!),
            parseInt(g.minutes!),
            parseInt(g.seconds!))
        );
    }
    throw new Error(`Not a valid timestamp string: ${timestampString}`);
}