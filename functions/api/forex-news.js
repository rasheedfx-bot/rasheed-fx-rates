const FEEDS = [
  {
    category: "Forex",
    url: "https://www.forexlive.com/feed/news"
  },
  {
    category: "Forex",
    url: "https://www.investing.com/rss/news_1.rss"
  },
  {
    category: "Crypto",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/"
  },
  {
    category: "Crypto",
    url: "https://cointelegraph.com/rss"
  }
];

function decode(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function getTag(xml, tag) {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i")
  );
  return match ? decode(match[1]) : "";
}

function parseFeed(xml, category, fallbackSource) {
  const blocks = xml.match(
    /<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi
  ) || [];

  return blocks.map(block => {
    const title = getTag(block, "title");

    let link = getTag(block, "link");

    if (!link) {
      const linkMatch = block.match(
        /<link[^>]+href=["']([^"']+)["']/i
      );
      if (linkMatch) link = linkMatch[1];
    }

    const date =
      getTag(block, "pubDate") ||
      getTag(block, "published") ||
      getTag(block, "updated");

    const source = getTag(block, "source") || fallbackSource;

    return {
      title,
      link,
      date,
      source,
      category
    };
  }).filter(item => item.title && item.link);
}

export async function onRequestGet() {
  const results = await Promise.all(
    FEEDS.map(async feed => {
      try {
        const response = await fetch(feed.url, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/rss+xml, application/xml, text/xml"
          }
        });

        if (!response.ok) {
          return {
            category: feed.category,
            status: response.status,
            items: []
          };
        }

        const xml = await response.text();

        return {
          category: feed.category,
          status: response.status,
          items: parseFeed(
            xml,
            feed.category,
            new URL(feed.url).hostname
          )
        };
      } catch (error) {
        return {
          category: feed.category,
          status: "fetch_error",
          items: []
        };
      }
    })
  );

  const items = results
    .flatMap(result => result.items)
    .filter((item, index, all) =>
      all.findIndex(other => other.link === item.link) === index
    )
    .sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    .slice(0, 40);

  return Response.json(
    {
      success: true,
      count: items.length,
      items,
      feeds: results.map(result => ({
        category: result.category,
        status: result.status,
        count: result.items.length
      }))
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300"
      }
    }
  );
}
