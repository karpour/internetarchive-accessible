import {
    NextFunction,
    Response,
    Request
} from "express";


export const RENDER_MODES = ["text", "html4", "ppc", "wap", "wap2"] as const;
export type RenderMode = typeof RENDER_MODES[number];

declare module 'express-serve-static-core' {
    interface Locals {
        mode: RenderMode;
    }
}

/** Mode detection middleware */
export function detectMode(req: Request, res: Response, next: NextFunction) {
    // Attach mode to response locals
    res.locals.mode = getMode(req.headers);
    if (req.query.mode && RENDER_MODES.includes(req.query.mode as RenderMode)) {
        res.locals.mode = req.query.mode as RenderMode;
    }
    console.log(`Detected mode: ${res.locals.mode}`);

    if (res.locals.mode === "wap2") {
        //res.header("Content-Type", "application/xhtml+xml");
    }

    // Monkey patch res.render
    const originalRender = res.render.bind(res);
    res.render = (view: string, options?: object, callback?: (err: Error, html: string) => void) => {
        const modePrefixedView = `${res.locals.mode}/${view}`;
        return originalRender(modePrefixedView, { ...options, mode: res.locals.mode }, callback);
    };

    next();
}


export function getMode(headers: any): RenderMode {
    const mapping: [RegExp, RenderMode][] = [
        [/^(?:Lynx|Links|w3m)/, "text"],
        [/240x320/, "ppc"],
        [/MSPIE|Windows CE/, "html4"],
        //[/.*/, "ppc"], // Default
    ];
    const ua = headers["user-agent"] || "";
    if (headers["accept"]?.includes("application/vnd.wap.xhtml+xml") && headers["x-wap-profile"]) {
        return "wap2";
    }
    for (let [regExp, mode] of mapping) {
        if (regExp.test(ua)) return mode;
    }
    return "html4";
};