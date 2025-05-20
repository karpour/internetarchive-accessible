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
    getSnapshotMatches
} from 'internetarchive-ts';
import { makeArray } from './util/makeArray';
import { decode } from 'html-entities';
import dateToYYYYMMDD from './util/dateToYYYYMMDD';
import { DEC_PREFIXES, formatUnit } from './util/formatUnit';
import { parseWaybackTimestamp } from './util/parseWaybackTimestamp';
import { tryParseInt } from './util/tryParseInt';
import { detectMode } from './util/detectMode';

const app = express();
const port = 3005;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, "..", 'views'));

function printErr(url: string, err: Error) {
    console.error(url);
    console.error(err);
    console.error('\n');
}

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
            fl: ["original", "statuscode", "timestamp"] // Specify which fields to return
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
    try {

        const item = await getItem(req.params.identifier);
        const collections: { identifier: string, name: string; }[] = makeArray(item.metadata.collection).map(el => ({
            identifier: el,
            name: el
        }));

        res.render('details', {
            identifier: req.params.identifier,
            title: item.metadata.title,
            pubDate: item.metadata.date,
            creator: item.metadata.creator,
            topics: item.metadata.subject ? makeArray(item.metadata.subject) : [],
            itemSize: item.item_size,
            description: decode(item.metadata.description as string ?? "[No description]"),
            collections,
            uploader: item.metadata.uploader,
            uploadDate: item.metadata.addeddate,
        });
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


app.get('*', function (req, res) {
    console.log(`404: ${req.url}`)
    res.status(404).render('message', { message: "Page not found" });
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

