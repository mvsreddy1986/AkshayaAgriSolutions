export const dynamic = "force-dynamic";

const fallbackMarket = {
  cornCents: 449,
  usdInr: 83.4,
};

function getInrPerTon(cornCents: number, usdInr: number) {
  const usdPerBushel = cornCents / 100;
  const cornBushelsPerMetricTon = 2204.62262 / 56;

  return usdPerBushel * usdInr * cornBushelsPerMetricTon;
}

async function getYahooPrice(symbol: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?interval=1m&range=1d`,
    {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Yahoo request failed for ${symbol}`);
  }

  const data = await response.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

  if (typeof price !== "number" || Number.isNaN(price)) {
    throw new Error(`Yahoo price missing for ${symbol}`);
  }

  return price;
}

export async function GET() {
  try {
    const [cornQuote, usdInr] = await Promise.all([
      getYahooPrice("ZC=F"),
      getYahooPrice("USDINR=X"),
    ]);
    const cornCents = cornQuote > 50 ? cornQuote : cornQuote * 100;
    const inrPerTon = getInrPerTon(cornCents, usdInr);

    return Response.json({
      cornCents,
      usdInr,
      inrPerTon,
      source: "live",
      updatedAt: new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      }).format(new Date()),
    });
  } catch {
    const inrPerTon = getInrPerTon(fallbackMarket.cornCents, fallbackMarket.usdInr);

    return Response.json(
      {
        ...fallbackMarket,
        inrPerTon,
        source: "fallback",
        updatedAt: "External market feed unavailable",
      },
      { status: 200 },
    );
  }
}
