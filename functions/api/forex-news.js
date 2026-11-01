const FEEDS = [
  "https://news.google.com/rss/search?q=Nigeria+forex+naira&hl=en-NG&gl=NG&ceid=NG:en",
  "https://news.google.com/rss/search?q=Central+Bank+of+Nigeria+foreign+exchange&hl=en-NG&gl=NG&ceid=NG:en",
  "https://news.google.com/rss/search?q=global+currency+markets+forex&hl=en&gl=US&ceid=US:en"
];

function getTag(xml, tag) {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i")
  );
  return match ? match[1].trim() : "";
}

function clean(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function parseFeed(xml) {
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];

  return items.map(item => {
    const title = clean(getTag(item, "title"));
    const link = clean(getTag(item, "link"));
    const date = clean(getTag(item, "pubDate"));
    const source = clean(getTag(item, "source")) || "Google News";

    return { title, link, date, source };
  }).filter(item =>
    item.title &&
    item.link.startsWith("https://")
  );
}

export async function onRequestGet() {
  try {
    const results = await Promise.allSettled(
      FEEDS.map(async url => {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "RasheedFXNews/1.0"
          },
          cf: {
            cacheTtl: 600,
            cacheEverything: true
          }
        });

        if (!response.ok) {
          throw new Error("News feed unavailable");
        }

        return parseFeed(await response.text());
      })
    );

    const items = results
      .filter(result => result.status === "fulfilled")
      .flatMap(result => result.value)
      .filter((item, index, array) =>
        array.findIndex(other => other.link === item.link) === index
      )
      .sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      .slice(0, 30);

    return new Response(JSON.stringify({
      success: true,
      count: items.length,
      items
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      items: [],
      error: "Unable to load forex news"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
