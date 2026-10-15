import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:43127";
const requiredTheaters = [
  "4 Star Theatre",
  "Alamo Drafthouse",
  "Apple Cinemas Van Ness IMAX",
  "Balboa Theatre",
  "Castro Theatre",
  "Landmark Opera Plaza Cinema",
  "Marina Theatre",
  "Presidio Theatre",
  "Regal Stonestown Galleria 12",
  "Roxie Theatre",
  "Vogue Theatre",
];

const [coreResponse, filteredResponse] = await Promise.all([
  fetch(`${baseUrl}/api/showtimes`),
  fetch(`${baseUrl}/api/showtimes?excludeAmc=1`),
]);
assert.equal(coreResponse.ok, true);
assert.equal(filteredResponse.ok, true);
const core = await coreResponse.json();
const filtered = await filteredResponse.json();
const multi = core.movies.find((movie) => movie.runs.length > 1 && movie.posterUrl);
const ellipsisMovie = core.movies.find((movie) => movie.runs.some((run) => run.endsAtPublishedHorizon));
assert.ok(multi);
assert.ok(ellipsisMovie);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  assert.equal(await page.locator("[aria-label='Choose a date']").count(), 0);
  assert.equal(await page.locator("article").count(), core.movies.length);
  assert.deepEqual((await page.locator("select option").allTextContents()).slice(1), requiredTheaters);

  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: multi.title, exact: true }),
  }).first();
  const poster = card.getByRole("img");
  const posterBox = await poster.boundingBox();
  assert.ok(posterBox && posterBox.height / posterBox.width > 1.45);
  assert.equal(await card.locator("li").count(), multi.runs.length);

  await card.getByRole("button", { name: `Open dates and showtimes for ${multi.title}` }).click();
  const dialog = page.getByRole("dialog");
  assert.equal(await dialog.locator("section").count(), multi.runs.length);
  assert.ok(await dialog.locator("a[href^='https://scenef.com/go/']").count() > 0);
  await dialog.getByRole("button", { name: "Close movie details" }).click();

  const ellipsisCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: ellipsisMovie.title, exact: true }),
  }).first();
  assert.ok((await ellipsisCard.innerText()).includes("…"));

  await page.getByLabel("Hide movies at AMC").check();
  await page.getByText(new RegExp(`${filtered.amcFilter.excludedMovieCount} AMC matches hidden`)).waitFor();
  assert.equal(await page.locator("article").count(), filtered.movies.length);
  assert.equal(
    await page.getByRole("heading", { name: filtered.amcFilter.excludedTitles[0], exact: true }).count(),
    0,
  );

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  const mobileCard = mobile.locator("article").first();
  const mobileCardBox = await mobileCard.boundingBox();
  assert.ok(mobileCardBox && mobileCardBox.width > 340 && mobileCardBox.width < 390);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await mobileCard.getByRole("button", { name: /Open dates and showtimes/ }).click();
  assert.equal(await mobile.getByRole("dialog").count(), 1);

  console.log(JSON.stringify({
    defaultCards: core.movies.length,
    filteredCards: filtered.movies.length,
    multiTheaterExample: { title: multi.title, theaters: multi.runs.length },
    posterRatio: Number((posterBox.height / posterBox.width).toFixed(2)),
    modalTheaterGroups: multi.runs.length,
    mobileCardWidth: Math.round(mobileCardBox.width),
  }, null, 2));
} finally {
  await browser.close();
}
