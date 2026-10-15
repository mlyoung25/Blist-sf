import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:43127";
const requiredTheaters = [
  "4 Star Theatre",
  "Alamo Drafthouse",
  "Apple Cinemas Van Ness IMAX",
  "Balboa Theatre",
  "Landmark Opera Plaza Cinema",
  "Marina Theatre",
  "Presidio Theatre",
  "Regal Stonestown Galleria 12",
  "Roxie Theatre",
  "Vogue Theatre",
];

const [defaultResponse, allHiddenResponse] = await Promise.all([
  fetch(`${baseUrl}/api/showtimes`),
  fetch(`${baseUrl}/api/showtimes?showAllHidden=1`),
]);
assert.equal(defaultResponse.ok, true);
assert.equal(allHiddenResponse.ok, true);
const defaultPayload = await defaultResponse.json();
const allHiddenPayload = await allHiddenResponse.json();
const oneDayCount = defaultPayload.movies.filter((movie) => movie.runs.every((run) => run.durationDays === 1)).length;
const multiDayCount = defaultPayload.movies.length - oneDayCount;
const multi = defaultPayload.movies.find((movie) => movie.runs.length > 1 && movie.posterUrl && movie.directors.length > 0 && movie.tmdbId);
const imdbRated = defaultPayload.movies.find((movie) => movie.ratings.imdb !== null);
const imdbUnavailable = defaultPayload.movies.find((movie) => movie.ratings.imdb === null);
const letterboxdRated = defaultPayload.movies.filter((movie) => movie.ratings.letterboxd !== null);
assert.ok(multi);
assert.ok(imdbRated);
assert.ok(imdbUnavailable);

function ratingScore(movie) {
  const ratings = [
    movie.ratings.imdb,
    movie.ratings.letterboxd === null ? null : movie.ratings.letterboxd * 2,
  ].filter((rating) => rating !== null);
  return ratings.length === 0 ? null : ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function relativeLuminance([red, green, blue]) {
  const channels = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const bright = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (bright + 0.05) / (dark + 0.05);
}

function rgb(value) {
  return value.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    const inject = () => {
      if (!document.documentElement) return false;
      document.documentElement.setAttribute("data-extension-injected", "test");
      return true;
    };
    if (!inject()) {
      const observer = new MutationObserver(() => {
        if (inject()) observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  assert.equal(await page.locator("article").count(), defaultPayload.movies.length);
  assert.equal(await page.locator("html").getAttribute("data-extension-injected"), "test");
  assert.equal(await page.getByLabel("Show all hidden").isChecked(), false);
  assert.equal(
    await page.locator("h2").filter({ hasText: defaultPayload.amcFilter.excludedTitles[0] }).count(),
    0,
  );
  assert.equal(await page.getByText("Castro Theatre", { exact: true }).count(), 0);

  const orderedIds = await page.locator("article").evaluateAll((articles) => articles.map((article) => ({
    id: article.dataset.movieId,
    category: article.dataset.sortCategory,
  })));
  const categoryRanks = { "one-day-today": 0, "multi-day": 1, "remaining": 2 };
  const movieById = new Map(defaultPayload.movies.map((movie) => [movie.id, movie]));
  const startMonth = (id) => movieById.get(id).runs.map((run) => run.startDate).sort()[0].slice(0, 7);
  assert.equal(orderedIds.every((item, index) => (
    index === 0 || startMonth(orderedIds[index - 1].id) <= startMonth(item.id)
  )), true);
  assert.equal(orderedIds.every((item, index) => (
    index === 0
    || startMonth(orderedIds[index - 1].id) !== startMonth(item.id)
    || categoryRanks[orderedIds[index - 1].category] <= categoryRanks[item.category]
  )), true);
  assert.equal(orderedIds.every((item, index) => {
    if (
      index === 0
      || startMonth(orderedIds[index - 1].id) !== startMonth(item.id)
      || orderedIds[index - 1].category !== item.category
    ) return true;
    const previous = ratingScore(movieById.get(orderedIds[index - 1].id));
    const current = ratingScore(movieById.get(item.id));
    return previous === null || current === null || previous >= current;
  }), true);

  const ratedCard = page.locator(`article[data-movie-id=${JSON.stringify(imdbRated.id)}]`);
  await ratedCard.getByText(`IMDb ${imdbRated.ratings.imdb.toFixed(1)}`, { exact: true }).waitFor();
  const unavailableCard = page.locator(`article[data-movie-id=${JSON.stringify(imdbUnavailable.id)}]`);
  await unavailableCard.getByText("IMDb unavailable", { exact: true }).waitFor();
  assert.equal(await page.getByText("Letterboxd unavailable", { exact: true }).count(), defaultPayload.movies.length);

  const theaterDetails = page.locator("details").first();
  await theaterDetails.locator("summary").click();
  assert.deepEqual(
    await theaterDetails.locator("label").allTextContents(),
    requiredTheaters,
  );
  await theaterDetails.getByLabel(requiredTheaters[0]).check();
  await theaterDetails.getByLabel(requiredTheaters[1]).check();
  const selectedIds = defaultPayload.venues.slice(0, 2).map((venue) => venue.id);
  const unionCount = defaultPayload.movies.filter((movie) => movie.runs.some((run) => selectedIds.includes(run.venueId))).length;
  assert.equal(await page.locator("article").count(), unionCount);
  await theaterDetails.getByRole("button", { name: "Clear" }).click();
  await theaterDetails.locator("summary").click();

  await page.getByLabel("Filter by run length").selectOption("one-day");
  assert.equal(await page.locator("article").count(), oneDayCount);
  assert.equal(await page.locator("article[data-run-type='multi-day']").count(), 0);
  const badge = page.getByText("One-day event").first();
  const colors = await badge.evaluate((element) => {
    const style = getComputedStyle(element);
    return { foreground: style.color, background: style.backgroundColor };
  });
  assert.ok(contrast(rgb(colors.foreground), rgb(colors.background)) >= 4.5);
  await page.getByLabel("Filter by run length").selectOption("multi-day");
  assert.equal(await page.locator("article").count(), multiDayCount);
  await page.getByLabel("Filter by run length").selectOption("all");

  const multiCard = page.locator(`article[data-movie-id=${JSON.stringify(multi.id)}]`);
  assert.equal(
    await multiCard.getByRole("link", { name: `${multi.title} on Letterboxd (opens in a new tab)` }).getAttribute("href"),
    `https://letterboxd.com/tmdb/${multi.tmdbId}/`,
  );
  assert.equal(
    await multiCard.getByRole("link", { name: `${multi.title} on TMDB (opens in a new tab)` }).getAttribute("href"),
    `https://www.themoviedb.org/movie/${multi.tmdbId}-${multi.normalizedTitle.replaceAll(" ", "-")}/`,
  );
  assert.equal(
    await multiCard.locator("a[target='_blank']").evaluateAll((links) => links.every((link) => link.querySelector("svg") !== null)),
    true,
  );
  await multiCard.getByRole("button", { name: `Open dates and showtimes for ${multi.title}` }).click();
  const dialog = page.getByRole("dialog");
  const titleLink = dialog.getByRole("link", { name: `${multi.title} on Letterboxd (opens in a new tab)` }).first();
  assert.equal(await titleLink.getAttribute("href"), `https://letterboxd.com/tmdb/${multi.tmdbId}/`);
  const directorLink = dialog.getByRole("link", { name: `${multi.directors[0]} on Letterboxd (opens in a new tab)` });
  assert.ok((await directorLink.getAttribute("href")).startsWith("https://letterboxd.com/search/"));
  for (const run of multi.runs) {
    assert.equal(
      await dialog.getByRole("link", { name: `${run.venueName} website (opens in a new tab)` }).getAttribute("href"),
      run.websiteUrl,
    );
  }
  assert.equal(
    await dialog.locator("a[target='_blank']").evaluateAll((links) => links.every((link) => link.querySelector("svg") !== null)),
    true,
  );
  await dialog.getByRole("button", { name: "Close movie details" }).click();

  const pinTarget = defaultPayload.movies.at(-1);
  const pinCard = page.locator(`article[data-movie-id=${JSON.stringify(pinTarget.id)}]`);
  await pinCard.getByRole("button", { name: `Pin ${pinTarget.title}` }).click();
  assert.equal(await page.locator("article").first().getAttribute("data-movie-id"), pinTarget.id);
  assert.equal(await page.locator("[data-divider]").first().getAttribute("data-divider"), "pinned");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("article").first().getAttribute("data-movie-id"), pinTarget.id);
  assert.equal(await page.locator("[data-divider='pinned']").count(), 1);

  const hideTarget = defaultPayload.movies.find((movie) => movie.id !== pinTarget.id);
  const hideCard = page.locator(`article[data-movie-id=${JSON.stringify(hideTarget.id)}]`);
  await hideCard.getByRole("button", { name: `Hide ${hideTarget.title}` }).click();
  assert.equal(await page.locator(`article[data-movie-id=${JSON.stringify(hideTarget.id)}]`).count(), 0);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(`article[data-movie-id=${JSON.stringify(hideTarget.id)}]`).count(), 0);

  await page.getByLabel("Show all hidden").check();
  await page.getByText("Movies", { exact: false }).first().waitFor();
  await page.locator(`article[data-movie-id=${JSON.stringify(hideTarget.id)}]`).waitFor();
  assert.equal(await page.locator("article").count(), allHiddenPayload.movies.length);
  assert.ok(await page.locator("h2").filter({ hasText: defaultPayload.amcFilter.excludedTitles[0] }).count() > 0);
  await page.locator(`article[data-movie-id=${JSON.stringify(hideTarget.id)}]`).getByRole("button", { name: `Unhide ${hideTarget.title}` }).click();
  await page.locator(`article[data-movie-id=${JSON.stringify(pinTarget.id)}]`).getByRole("button", { name: `Unpin ${pinTarget.title}` }).click();
  await page.getByLabel("Show all hidden").uncheck();
  await page.locator("article").first().waitFor();

  const monthValidation = await page.locator("main .grid").last().evaluate((grid, movies) => {
    const starts = new Map(movies.map((movie) => [movie.id, movie.runs.map((run) => run.startDate).sort()[0].slice(0, 7)]));
    let activeMonth = null;
    for (const child of grid.children) {
      if (child instanceof HTMLElement && child.dataset.divider && child.dataset.divider !== "pinned") {
        activeMonth = child.dataset.divider;
      }
      if (child instanceof HTMLElement && child.dataset.movieId && starts.get(child.dataset.movieId) !== activeMonth) {
        return false;
      }
    }
    return true;
  }, defaultPayload.movies);
  assert.equal(monthValidation, true);

  const unlabeledControls = await page.locator("button,input,select,a").evaluateAll((elements) => elements.filter((element) => {
    if (element instanceof HTMLInputElement && element.labels?.length) return false;
    if (element instanceof HTMLSelectElement && element.labels?.length) return false;
    return !(element.getAttribute("aria-label") || element.textContent?.trim());
  }).length);
  assert.equal(unlabeledControls, 0);

  const mobile = await context.newPage();
  mobile.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  mobile.on("pageerror", (error) => pageErrors.push(error.message));
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  const mobileCardBox = await mobile.locator("article").first().boundingBox();
  assert.ok(mobileCardBox && mobileCardBox.width > 340 && mobileCardBox.width < 390);

  const hydrationErrors = consoleErrors.filter((message) => /hydration|did not match|server rendered/i.test(message));
  assert.deepEqual(hydrationErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    defaultMovieCount: defaultPayload.movies.length,
    recoveredMovieCount: allHiddenPayload.movies.length,
    amcHiddenCount: defaultPayload.amcFilter.excludedMovieCount,
    userHidePersisted: true,
    pinPersistedAndSortedFirst: true,
    oneDayCount,
    multiDayCount,
    oneDayBadgeContrast: Number(contrast(rgb(colors.foreground), rgb(colors.background)).toFixed(2)),
    theaterMultiselectUnionCount: unionCount,
    monthDividersValidated: true,
    mobileCardWidth: Math.round(mobileCardBox.width),
    imdbRatingCoverage: defaultPayload.movies.filter((movie) => movie.ratings.imdb !== null).length,
    letterboxdRatingCoverage: letterboxdRated.length,
    sortCategoriesVerified: true,
    externalLinkIconsVerified: true,
    hydrationErrors: hydrationErrors.length,
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
  }, null, 2));
} finally {
  await browser.close();
}
