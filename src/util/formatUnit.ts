export const SI_PREFIXES = [
    { value: 1e12, symbol: "T" },
    { value: 1e9, symbol: "G" },
    { value: 1e6, symbol: "M" },
    { value: 1e3, symbol: "k" },
    { value: 1, symbol: "" },
    { value: 1e-3, symbol: "m" },
    { value: 1e-6, symbol: "\xB5" },
    { value: 1e-9, symbol: "n" },
    { value: 1e-12, symbol: "p" }
];


export const DEC_PREFIXES = [
    { value: 1e12, symbol: "T" },
    { value: 1e9, symbol: "B" },
    { value: 1e6, symbol: "M" },
    { value: 1e3, symbol: "k" },
    { value: 1, symbol: "" },
];

export function formatUnit(value: number, prefixes: { value: number, symbol: string; }[] = SI_PREFIXES) {
    if (value == null) return "";
    if (value === 0) return "0";
    const absValue = Math.abs(value);
    const prefix = prefixes.find((p) => {
        const scaled2 = absValue / p.value;
        return scaled2 >= 1 && scaled2 < 1e3;
    }) || prefixes[prefixes.length - 1];
    const scaled = value / prefix!.value;
    let formatted = scaled.toPrecision(3);
    if (formatted.includes(".") && !/\.0+$/.test(formatted)) {
        formatted = formatted.replace(/0+$/, "");

    }
    formatted = formatted.replace(/\.0+$/, "");
    return `${formatted}${prefix!.symbol}`;
}