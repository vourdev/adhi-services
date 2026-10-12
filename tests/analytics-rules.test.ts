import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  classifySource,
  detectDevice,
  isBot,
  referrerHost,
} from "@/lib/analytics/classify";
import { percentChange, rate } from "@/lib/analytics/metrics";
import {
  dayKey,
  eachDay,
  parseRange,
  previousRange,
  startOfDayMs,
} from "@/lib/analytics/range";
import { resolveSource } from "@/server/analytics/ingest";

const site = "adhinugroho.id";

describe("traffic source classification", () => {
  test("no referrer and no UTM is direct, never social", () => {
    assert.equal(
      classifySource({
        referrerHost: null,
        utmSource: null,
        utmMedium: null,
        siteHost: site,
      }),
      "direct"
    );
  });

  test("referrer hosts map to search, social or referral", () => {
    const cases: Array<[string, string]> = [
      ["https://www.google.co.id/", "search"],
      ["https://l.instagram.com/?u=x", "social"],
      ["https://lm.facebook.com/l.php", "social"],
      ["https://t.co/abc", "social"],
      ["https://www.tiktok.com/@x", "social"],
      ["https://news.ycombinator.com/", "referral"],
    ];
    for (const [referrer, expected] of cases) {
      assert.equal(
        classifySource({
          referrerHost: referrerHost(referrer),
          utmSource: null,
          utmMedium: null,
          siteHost: site,
        }),
        expected,
        referrer
      );
    }
  });

  test("UTM parameters take priority over the referrer", () => {
    assert.equal(
      classifySource({
        referrerHost: "google.com",
        utmSource: "instagram",
        utmMedium: null,
        siteHost: site,
      }),
      "social"
    );
    assert.equal(
      classifySource({
        referrerHost: null,
        utmSource: "newsletter",
        utmMedium: "email",
        siteHost: site,
      }),
      "referral"
    );
    assert.equal(
      classifySource({
        referrerHost: null,
        utmSource: "flyer",
        utmMedium: "print",
        siteHost: site,
      }),
      "other"
    );
  });

  test("a referrer from this same site counts as direct", () => {
    assert.equal(
      classifySource({
        referrerHost: site,
        utmSource: null,
        utmMedium: null,
        siteHost: `www.${site}`,
      }),
      "direct"
    );
  });

  test("in-site navigation keeps the session's original source", () => {
    const result = resolveSource(
      {
        referrer: `https://${site}/adhi/produk`,
        utmSource: null,
        utmMedium: null,
      },
      { sessionSource: "social", siteHost: site }
    );
    assert.deepEqual(result, { source: "social", referrerHost: null });
  });

  test("unparseable referrers are ignored", () => {
    assert.equal(referrerHost("not a url"), null);
    assert.equal(referrerHost("javascript:alert(1)"), null);
    assert.equal(
      referrerHost("https://WWW.Example.com/path?q=1"),
      "example.com"
    );
  });
});

describe("device and bot detection", () => {
  test("classifies common user agents", () => {
    assert.equal(
      detectDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148"
      ),
      "mobile"
    );
    assert.equal(
      detectDevice(
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Mobile Safari/537.36"
      ),
      "mobile"
    );
    assert.equal(
      detectDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"),
      "tablet"
    );
    assert.equal(
      detectDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"
      ),
      "desktop"
    );
    assert.equal(detectDevice(null), "unknown");
  });

  test("link preview fetchers and scripts are bots, browsers are not", () => {
    assert.equal(
      isBot(
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
      ),
      true
    );
    assert.equal(isBot("WhatsApp/2.23.20.0 A"), true);
    assert.equal(
      isBot("Googlebot/2.1 (+http://www.google.com/bot.html)"),
      true
    );
    assert.equal(isBot("curl/8.4.0"), true);
    assert.equal(isBot(""), true);
    assert.equal(
      isBot(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36 Instagram 340.0"
      ),
      false
    );
  });
});

describe("date ranges (WIB)", () => {
  // 2026-10-11 01:30 WIB = 2026-10-10 18:30 UTC
  const now = Date.parse("2026-10-10T18:30:00Z");

  test("today starts at 00:00 WIB", () => {
    const range = parseRange({ range: "today" }, now);
    assert.equal(range.from, "2026-10-11");
    assert.equal(range.startMs, Date.parse("2026-10-10T17:00:00Z"));
    assert.equal(range.days, 1);
  });

  test("presets include today and default to 30 days", () => {
    assert.equal(parseRange({ range: "7d" }, now).from, "2026-10-05");
    assert.equal(parseRange({}, now).days, 30);
    assert.equal(parseRange({ range: "nonsense" }, now).preset, "30d");
    assert.equal(parseRange({ range: "90d" }, now).days, 90);
  });

  test("custom ranges are validated, swapped and clamped to today", () => {
    const range = parseRange(
      { range: "custom", from: "2026-10-20", to: "2026-10-01" },
      now
    );
    assert.equal(range.from, "2026-10-01");
    assert.equal(range.to, "2026-10-11");
    assert.equal(
      parseRange({ range: "custom", from: "bad", to: "2026-10-01" }, now)
        .preset,
      "30d"
    );
  });

  test("previous range has the same length and ends where the current one starts", () => {
    const range = parseRange({ range: "7d" }, now);
    const previous = previousRange(range);
    assert.equal(previous.days, 7);
    assert.equal(previous.endMs, range.startMs);
    assert.equal(eachDay(range).length, 7);
  });

  test("dayKey and startOfDayMs round-trip", () => {
    assert.equal(dayKey(startOfDayMs("2026-01-31")), "2026-01-31");
  });
});

describe("metric math", () => {
  test("rates are null when the denominator is zero", () => {
    assert.equal(rate(5, 0), null);
    assert.equal(rate(1, 4), 25);
    assert.equal(percentChange(10, 0), null);
    assert.equal(percentChange(15, 10), 50);
  });
});
