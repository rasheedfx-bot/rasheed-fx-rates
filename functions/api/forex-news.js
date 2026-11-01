const FEEDS = [
  "https://news.google.com/rss/search?q=USD+NGN+Naira+exchange+rate&hl=en-NG&gl=NG&ceid=NG:en",
  "https://news.google.com/rss/search?q=CBN+foreign+exchange+Nigeria&hl=en-NG&gl=NG&ceid=NG:en",
  "https://news.google.com/rss/search?q=Nigeria+forex+market+Naira&hl=en-NG&gl=NG&ceid=NG:en",
  "https://news.google.com/rss/search?q=global+forex+currency+markets+USD+EUR+GBP&hl=en&gl=US&ceid=US:en"
];

function decode(value) {
  return (value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getTag(xml, tag) {
  const regex = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    "i"
  );
  return xml.match(regex)?.[1] || "";
}

function parseFeed(xml) {
  const entries = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return entries.map(entry => {
    const title = decode(getTag(entry, "title")).trim();
    const link = decode(getTag(entry, "link")).trim();
    const date = decode(getTag(entry, "pubDate")).trim();
    const source = decode(getTag(entry, "source")).trim();

    return {
      title,
      link,
      date,
      source: source || "Google News"
    };
  }).filter(item =>
    item.title &&
    item.link.startsWith("https://")
  );
}

export async function onRequestGet() {
  const results = await Promise.allSettled(
    FEEDS.map(async feed => {
      const response = await fetch(feed);

      if (!response.ok) {
        throw new Error("Feed unavailable");
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
      "Cache-Control": "public, max-age=300"
    }
  });
}
