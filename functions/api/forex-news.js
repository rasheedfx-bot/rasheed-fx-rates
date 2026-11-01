const FEEDS = [
  "https://feeds.bbci.co.uk/news/business/rss.xml",
  "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  "https://www.investing.com/rss/news_25.rss"
];

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extract(xml) {
  const entries = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];

  return entries.map(entry => {
    const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = entry.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const hrefMatch = entry.match(/<link[^>]+href=["']([^"']+)["']/i);
    const dateMatch = entry.match(/<(pubDate|published|updated)>([\s\S]*?)<\/\1>/i);

    const title = decode(titleMatch?.[1] || "").trim();
    let link = decode(linkMatch?.[1] || hrefMatch?.[1] || "").trim();

    if (link.startsWith("www.")) link = "https://" + link;

    return {
      title,
      link,
      date: decode(dateMatch?.[2] || "").trim(),
      source: "News"
    };
  }).filter(item =>
    item.title &&
    item.link.startsWith("https://")
  );
}

export async function onRequestGet() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const response = await fetch(feed);

      if (!response.ok) throw new Error("Feed unavailable");

      const xml = await response.text();
      return extract(xml);
    })
  );

  const items = results
    .filter(result => result.status === "fulfilled")
    .flatMap(result => result.value)
    .filter((item, index, array) =>
      array.findIndex(other => other.link === item.link) === index
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
