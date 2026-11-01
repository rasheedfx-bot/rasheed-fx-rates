const FEEDS = [
  {
    category: "Forex",
    url: "https://news.google.com/rss/search?q=forex+market+OR+foreign+exchange&hl=en-US&gl=US&ceid=US:en"
  },
  {
    category: "Nigeria",
    url: "https://news.google.com/rss/search?q=USD+NGN+Naira+exchange+rate&hl=en-US&gl=NG&ceid=NG:en"
  },
  {
    category: "Crypto",
    url: "https://news.google.com/rss/search?q=cryptocurrency+market+Bitcoin&hl=en-US&gl=US&ceid=US:en"
  }
];

function cleanText(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function getTag(xml, tag) {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i")
  );

  return match ? cleanText(match[1]) : "";
}

function parseFeed(xml, category) {
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];

  return items.map(item => {
    const title = getTag(item, "title");
    const link = getTag(item, "link");
    const date = getTag(item, "pubDate");
    const source = getTag(item, "source");

    return {
      title,
      link,
      date,
      source: source || "Google News",
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
            "User-Agent": "Mozilla/5.0 RasheedFxNews/1.0",
            "Accept": "application/rss+xml, application/xml, text/xml"
          }
        });

        if (!response.ok) {
          return {
            items: [],
            status: response.status,
            category: feed.category
          };
        }

        const xml = await response.text();

        return {
          items: parseFeed(xml, feed.category),
          status: response.status,
          category: feed.category
        };
      } catch (error) {
        return {
          items: [],
          status: "fetch_error",
          category: feed.category
        };
      }
    })
  );

  const items = results
    .flatMap(result => result.items)
    .filter((item, index, array) =>
      array.findIndex(other => other.title === item.title) === index
    )
    .sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
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
