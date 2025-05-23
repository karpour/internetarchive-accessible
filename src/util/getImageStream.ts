import { spawn } from 'child_process';
import { Readable, pipeline } from 'stream';

export async function getImageStream(url: string, width: number, height: number, imageFormat: "gif" | "wbmp"): Promise<Readable> {
    // Fetch the image using built-in fetch API
    console.log(`Fetching IMG ${url}`);

    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // Convert the response body (web ReadableStream) to a Node.js Readable stream
    const reader = response.body.getReader();
    const readableStream = new Readable({
        read() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    this.push(null);
                } else {
                    this.push(value);
                }
            }).catch(err => this.destroy(err));
        }
    });

    const convertArgs = ["-"]; // Read input from stdin
    if (width > 0 && height > 0) convertArgs.push("-resize", `${width}x${height}`);
    convertArgs.push(`${imageFormat.toUpperCase()}:-`); // Output to stdout

    // Define ImageMagick process
    const convert = spawn("convert", convertArgs);

    // Handle errors in ImageMagick
    convert.stderr.on("data", (data) => {
        console.error("ImageMagick error:", data.toString());
    });

    pipeline(
        readableStream,
        convert.stdin,
        (err) => {
            if (err) {
                console.error("Pipeline error:", err);
                throw new Error("Failed to convert image");
            }
        }
    );

    return convert.stdout;
}
