// server.ts
import express, { Response, NextFunction } from 'express';
import path from 'path';
import {
    getAnnouncements,
    getItem,
    getMediacounts,
    getTopCollections,
    IaApiItemNotFoundError,
    searchItems,
    getSnapshotMatches,
    getShortViewcounts,
    isValidIaIdentifier
} from 'internetarchive-ts';
import { makeArray } from './util/makeArray';
import { decode } from 'html-entities';
import dateToYYYYMMDD from './util/dateToYYYYMMDD';
import { DEC_PREFIXES, formatUnit } from './util/formatUnit';
import { parseWaybackTimestamp } from './util/parseWaybackTimestamp';
import { tryParseInt } from './util/tryParseInt';
import { detectMode } from './util/detectMode';
import { pipeline } from 'stream';
import { getImageStream } from './util/getImageStream';

const app = express();
const port = 3005;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, "..", 'views'));

function printErr(url: string, err: Error) {
    console.error(url);
    console.error(err);
    console.error('\n');
}

express.static.mime.define({ "image/vnd.wap.wbmp": ["wbmp"] });
express.static.mime.define({ "image/gif": ["gif"] });


app.use("/", express.static(path.join(__dirname, "..", "static")));

app.use(detectMode);

// Home page
app.get('/', async (req, res) => {
    try {
        const announcements = await getAnnouncements();
        const mediacountsRaw = await getMediacounts();
        const mediacounts: Record<string, string> = {};
        for (const entry of Object.entries(mediacountsRaw)) {
            mediacounts[entry[0]] = formatUnit(entry[1], DEC_PREFIXES);
        }
        const topCollections = await getTopCollections(10);

        const data = {
            announcements,
            mediacounts,
            mediacountsRaw,
            topCollections
        };

        res.render('index', data);
    } catch (err: any) {
        res.status(404).render('message', { message: `Error: ${err.message}` });
        printErr(req.url, err);
    }
});

// Static pages
app.get('/contact', async (req, res) => {
    res.render('contact');
});

app.get('/projects', async (req, res) => {
    res.render('projects');
});

app.get('/people', async (req, res) => {
    res.render('people');
});

app.get('/volunteer', async (req, res) => {
    res.render('volunteer');
});

app.get('/donate', async (req, res) => {
    res.render('donate');
});

app.get('/about', async (req, res) => {
    res.render('about');
});

app.get('/ua', async (req, res) => {
    console.log("USER AGENT");
    console.log(req.get('user-agent'));
    console.log(req.headers);
    res.end(req.get('user-agent'));
});


// WaybackMachine search
app.get('/web', async (req, res) => {
    // Render just search box if theres no query
    if (!req.query.query || req.query.query == "") {
        res.render('web');
        return;
    }

    try {
        const query = `${req.query.query}`;

        const matches = await getSnapshotMatches(query, {
            limit: 500, // Limit to 100 results
            collapse: "timestamp:6", // Limit to one result per month
            fl: ["original", "statuscode", "timestamp"], // Specify which fields to return
            filter: (res.locals.mode === "wap" || res.locals.mode === "wap2") && ["statuscode:200", "mimetype:.*vnd.*"] || undefined
        });

        const results: {
            original: string,
            date: string,
            timestamp: string,
            statuscode: string,
        }[] = matches.map(m => ({
            ...m,
            date: dateToYYYYMMDD(parseWaybackTimestamp(m.timestamp))
        }));

        res.render('web', { results });
    } catch (err: any) {
        res.status(404).render('message', { message: `Error: ${err.message}` });
        printErr(req.url, err);
    }
});

// File Listing page
app.get('/download/:identifier', async (req, res) => {
    const identifier = req.params.identifier;
    try {
        const item = await getItem(identifier);
        const files = item.files.map(f => ({
            date: dateToYYYYMMDD(new Date(parseInt(f.mtime ?? item.item_last_updated) * 1000)),
            size: f.size ? formatUnit(parseInt(f.size)) : "-",
            name: f.name
        }));
        res.render('download', { files, identifier });
    } catch (err: any) {
        console.error(err);
        if (err instanceof IaApiItemNotFoundError) {
            res.status(404).render('notfound', { identifier });
        } else {
            res.status(500).render('message', { message: err.message });
            printErr(req.url, err);
        }
    }
});

// Item details page
app.get('/details/:identifier', async (req, res) => {
    const identifier = req.params.identifier;
    try {
        if (!isValidIaIdentifier(identifier)) throw new Error(`Invalid identifier`);
        const item = await getItem(identifier);
        const viewcounts = await getShortViewcounts([identifier]);
        const data = {
            identifier: req.params.identifier,
            title: item.metadata.title,
            pubDate: item.metadata.date,
            creator: item.metadata.creator,
            topics: item.metadata.subject ? makeArray(item.metadata.subject) : [],
            itemSize: item.item_size,
            description: decode(item.metadata.description as string ?? "[No description]")
                .replace(/https?:\/\/archive.org\/search.php/g, '/search')
                .replace(/https?:\/\/archive.org/g, ''),
            uploader: item.metadata.uploader,
            uploadDate: item.metadata.addeddate,
            views: viewcounts[identifier]?.all_time ?? 0
        };

        if (item.metadata.mediatype === "collection") {
            const page = tryParseInt(req.query.page);
            const search = await searchItems(`collection:(${identifier})`, {
                fields: ["identifier", "title", "mediatype"],
                rows: 20
            });
            const results = await search.getResults(page);
            res.render('collection', { ...data, results: results.response.docs, numFound: results.response.numFound, page });
        } else if (item.metadata.mediatype === "account") {

        } else {
            const collections: { identifier: string, name: string; }[] = makeArray(item.metadata.collection).map(el => ({
                identifier: el,
                name: el
            }));
            res.render('details', { ...data, collections });
        }
    } catch (err: any) {
        res.status(404).render('message', { message: `Error: ${err.message}` });
        printErr(req.url, err);
    }
});

// Search results page
app.get('/search', async (req, res) => {
    const query = req.query.query;
    const page = tryParseInt(req.query.page);
    console.log(`GET "${query}" Page ${page}`);
    try {
        if (typeof query === "string" && query !== "") {
            const search = await searchItems(query, { fields: ["identifier", "title"] });
            const results = await search.getResults(page);
            res.render('results', { results: results.response.docs, numFound: results.response.numFound, page, query });
        } else {
            res.render('results', { results: undefined, numFound: 0, page, query: "" });
        }
    } catch (err: any) {
        res.status(404).render('message', { message: `Error: ${err.message}` });
        printErr(req.url, err);
    }
});

app.get("/services/img/:identifier", async (req, res) => {
    if (!isValidIaIdentifier(req.params.identifier)) {
        res.status(403).end("Not a valid identifier");
    }
    const width = parseInt(`${req.query.w}`) || 0;
    const height = parseInt(`${req.query.h}`) || 0;
    try {
        const imageStream = await getImageStream(`https://archive.org/services/img/${req.params.identifier}`, width, height, "gif");
        res.setHeader("Content-Type", "image/gif");
        pipeline(
            imageStream,
            res,
            (err) => {
                if (err) {
                    console.error("Pipeline error:", err);
                    res.status(500).send("Error streaming image");
                }
            }
        );
    } catch (err) {
        res.status(500).end("Could not load image");
    }
});



app.get('*', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`${ip} 404: ${req.url}`);

    res.setHeader('Content-Type', 'text/plain');
    function delay(time: number) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    for (let i = 0; i < 1000; i++) {
        res.write(`${Math.round(Math.random())}`);
        await delay(10000);
    }
    console.log(`${ip} 404: ${req.url} TIMEOUT`);

    res.socket?.destroy();
    //res.status(404).render('message', { message: "Page not found" });
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

