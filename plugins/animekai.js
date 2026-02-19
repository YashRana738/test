const mainUrl = "https://anikai.to";
const commonHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": mainUrl + "/",
    "Connection": "keep-alive"
};

function getManifest() {
    return {
        name: "AnimeKai",
        id: "com.animekai.provider",
        version: 1,
        baseUrl: mainUrl,
        type: "Anime",
        language: "en"
    };
}

// =================================================================================================
// 1. HOME PAGE
// =================================================================================================

function getHome(callback) {
    const inputs = [
        { title: "Trending", url: `${mainUrl}/browser?keyword=&status[]=releasing&sort=trending` },
        { title: "Latest Episode", url: `${mainUrl}/browser?keyword=&status[]=releasing&sort=updated_date` },
        { title: "Recently SUB", url: `${mainUrl}/browser?keyword=&type[]=tv&status[]=releasing&sort=added_date&language[]=sub&language[]=softsub` },
        { title: "Recently DUB", url: `${mainUrl}/browser?keyword=&type[]=tv&status[]=releasing&sort=added_date&language[]=dub` }
    ];

    let result = [];
    let pending = inputs.length;

    inputs.forEach(input => {
        http_get(input.url, commonHeaders, (status, html) => {
            if (status === 200) {
                const items = parseAnimeList(html);
                if (items.length > 0) {
                    result.push({ title: input.title, Data: items });
                }
            }
            pending--;
            if (pending === 0) {
                // Determine order based on inputs
                const final = [];
                inputs.forEach(i => {
                    const found = result.find(r => r.title === i.title);
                    if (found) final.push(found);
                });
                callback(JSON.stringify(final));
            }
        });
    });
}


function parseAnimeList(html) {
    const items = [];
    // Regex to capture anime item details
    // Matches: <div class="aitem">...<a href="URL"...<img data-src="IMG"...<a class="title">TITLE</a>
    const regex = /<div class="aitem">[\s\S]*?<a class="poster" href="([^"]+)"[\s\S]*?data-src="([^"]+)"[\s\S]*?<a class="title"[^>]*>([^<]+)<\/a>/g;

    let match;
    while ((match = regex.exec(html)) !== null) {
        let href = match[1];
        let poster = match[2];
        let title = match[3];

        if (!href.startsWith("http")) href = mainUrl + href;
        if (!poster.startsWith("http")) poster = mainUrl + poster;

        items.push({
            title: title.trim(),
            url: href,
            posterUrl: poster,
            headers: commonHeaders
        });
    }
    return items;
}

// =================================================================================================
// 2. SEARCH
// =================================================================================================

function search(query, callback) {
    const url = `${mainUrl}/browser?keyword=${encodeURIComponent(query)}`;
    http_get(url, commonHeaders, (status, html) => {
        const items = parseAnimeList(html);
        callback(JSON.stringify([{ title: "Search Results", Data: items }]));
    });
}

// =================================================================================================
// 3. DETAILS (Load)
// =================================================================================================

function load(url, callback) {
    http_get(url, commonHeaders, (status, html) => {
        // Basic Metadata
        const titleMatch = html.match(/<h1 class="title"[^>]*>([^<]+)<\/h1>/);
        const title = titleMatch ? titleMatch[1].trim() : "Unknown";

        const posterMatch = html.match(/<div class="poster">[\s\S]*?src="([^"]+)"/);
        let poster = posterMatch ? posterMatch[1] : "";
        if (poster && !poster.startsWith("http")) poster = mainUrl + poster;

        const descMatch = html.match(/<div class="desc"[^>]*>([\s\S]*?)<\/div>/);
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : "";

        // Extract IDs
        const aniIdMatch = html.match(/data-al-id="(\d+)"/);
        const aniId = aniIdMatch ? aniIdMatch[1] : null;

        const animeIdMatch = html.match(/data-id="([^"]+)"/);
        const animeId = animeIdMatch ? animeIdMatch[1] : ""; // Internal ID

        let returnObj = {
            url: url,
            data: animeId,
            title: title,
            description: desc,
            posterUrl: poster,
            year: 0,
            status: "Unknown"
        };

        if (aniId) {
            const query = `query ($id: Int = ${aniId}) { Media(id: $id, type: ANIME) { id title { romaji english } startDate { year } description status bannerImage coverImage { extraLarge } } }`;

            // Try to fetch AniList data
            // Note: If http_post is not consistent, this block might fail or timeout silently in some engines.
            // We use a try-catch pattern and a fallback.

            // Construct the POST request manually if needed or standard http_post
            const postBody = JSON.stringify({ query: query });
            const postHeaders = {
                "Content-Type": "application/json",
                "Accept": "application/json"
            };

            http_post("https://graphql.anilist.co", postHeaders, postBody, (s, r) => {
                if (s === 200) {
                    try {
                        const json = JSON.parse(r);
                        const media = json.data.Media;
                        if (media) {
                            returnObj.posterUrl = media.coverImage.extraLarge || returnObj.posterUrl;
                            returnObj.backgroundPosterUrl = media.bannerImage || "";
                            returnObj.description = media.description ? media.description.replace(/<br>/g, "\n") : returnObj.description;
                            returnObj.year = media.startDate.year || 0;
                            returnObj.status = media.status || "Unknown";
                            if (media.title && media.title.english) returnObj.title = media.title.english;
                        }
                    } catch (e) {
                        // JSON Parse error, ignore
                    }
                }
                callback(JSON.stringify(returnObj));
            });
        } else {
            callback(JSON.stringify(returnObj));
        }
    });
}

// =================================================================================================
// 4. STREAMS (Stubbed)
// =================================================================================================
// Requires decryption keys (BuildConfig.KAIENC) to fetch episodes.
// Without keys, streams cannot be loaded.

function loadStreams(url, callback) {
    callback(JSON.stringify([]));
}
