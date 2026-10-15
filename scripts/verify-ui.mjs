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
const onFilmMovies = defaultPayload.movies.filter((movie) => movie.onFilm.matched);
const isOneDay = (movie) => movie.runs.every((run) => run.durationDays === 1);
const oneDayOnlyMovie = defaultPayload.movies.find((movie) => isOneDay(movie) && !movie.onFilm.matched);
const dualBorderMovie = defaultPayload.movies.find((movie) => isOneDay(movie) && movie.onFilm.matched);
const onFilmOnlyMovie = allHiddenPayload.movies.find((movie) => !isOneDay(movie) && movie.onFilm.matched);
const neutralMovie = defaultPayload.movies.find((movie) => !isOneDay(movie) && !movie.onFilm.matched);
const unknownLanguageMovie = defaultPayload.movies.find((movie) => movie.languages.length === 0);
const knownLanguageMovie = defaultPayload.movies.find((movie) => movie.languages.length > 0);
const directorSearchTarget = defaultPayload.movies.find((movie) => movie.directors.some((director) => {
  const searchableWithoutDirectors = [
    movie.title,
    movie.genres.join(" "),
    movie.runs.map((run) => run.venueName).join(" "),
  ].join(" ").toLowerCase();
  return !searchableWithoutDirectors.includes(director.toLowerCase());
}));
const availableDates = [...new Set(defaultPayload.movies.flatMap((movie) => (
  movie.runs.flatMap((run) => run.dates.map((date) => date.date))
)))].sort();
assert.ok(multi);
assert.ok(imdbRated);
assert.ok(imdbUnavailable);
assert.ok(onFilmMovies.length > 0);
assert.ok(oneDayOnlyMovie);
assert.ok(dualBorderMovie);
assert.ok(onFilmOnlyMovie);
assert.ok(neutralMovie);
assert.ok(unknownLanguageMovie);
assert.ok(directorSearchTarget);
assert.equal(defaultPayload.onFilmSource.error, undefined);
assert.equal(defaultPayload.onFilmSource.matchedMovieCount, onFilmMovies.length);
assert.equal(onFilmMovies.every((movie) => movie.onFilm.sourceUrl === "https://scenef.com/on-film"), true);

function ratingScore(movie) {
  return movie.ratings.imdb;
}

function relevantDate(movie) {
  return movie.runs.flatMap((run) => run.dates.map((date) => date.date)).sort()[0];
}

function formatDate(date, includeYear = false) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

async function ringGeometry(card) {
  return card.evaluate((article) => {
    const frame = article.querySelector("[data-card-frame]");
    if (!(frame instanceof HTMLElement)) throw new Error("Card frame is missing.");
    const outer = getComputedStyle(article);
    const inner = getComputedStyle(frame);
    const outerBox = article.getBoundingClientRect();
    const innerBox = frame.getBoundingClientRect();
    return {
      outerWidths: [outer.borderTopWidth, outer.borderRightWidth, outer.borderBottomWidth, outer.borderLeftWidth],
      outerColors: [outer.borderTopColor, outer.borderRightColor, outer.borderBottomColor, outer.borderLeftColor],
      padding: [outer.paddingTop, outer.paddingRight, outer.paddingBottom, outer.paddingLeft],
      innerWidths: [inner.borderTopWidth, inner.borderRightWidth, inner.borderBottomWidth, inner.borderLeftWidth],
      innerColors: [inner.borderTopColor, inner.borderRightColor, inner.borderBottomColor, inner.borderLeftColor],
      offsets: [
        innerBox.top - outerBox.top,
        outerBox.right - innerBox.right,
        outerBox.bottom - innerBox.bottom,
        innerBox.left - outerBox.left,
      ],
    };
  });
}

function assertCompleteDualRings(geometry) {
  assert.deepEqual(geometry.outerWidths, ["2px", "2px", "2px", "2px"]);
  assert.deepEqual(geometry.innerWidths, ["2px", "2px", "2px", "2px"]);
  assert.equal(new Set(geometry.outerColors).size, 1);
  assert.equal(new Set(geometry.innerColors).size, 1);
  assert.notEqual(geometry.outerColors[0], geometry.innerColors[0]);
  assert.deepEqual(geometry.padding, ["3px", "3px", "3px", "3px"]);
  assert.equal(geometry.offsets.every((offset) => Math.abs(offset - 5) < 0.1), true);
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

  const orderedIds = await page.locator("article").evaluateAll((articles) => articles.map((article) => article.dataset.movieId));
  const movieById = new Map(defaultPayload.movies.map((movie) => [movie.id, movie]));
  const startMonth = (id) => movieById.get(id).runs.map((run) => run.startDate).sort()[0].slice(0, 7);
  assert.equal(orderedIds.every((id, index) => (
    index === 0 || startMonth(orderedIds[index - 1]) <= startMonth(id)
  )), true);
  assert.equal(orderedIds.every((id, index) => (
    index === 0
    || startMonth(orderedIds[index - 1]) !== startMonth(id)
    || relevantDate(movieById.get(orderedIds[index - 1])) <= relevantDate(movieById.get(id))
  )), true);
  assert.equal(orderedIds.every((id, index) => {
    if (
      index === 0
      || startMonth(orderedIds[index - 1]) !== startMonth(id)
      || relevantDate(movieById.get(orderedIds[index - 1])) !== relevantDate(movieById.get(id))
    ) return true;
    const previous = ratingScore(movieById.get(orderedIds[index - 1]));
    const current = ratingScore(movieById.get(id));
    return previous === null || current === null || previous >= current;
  }), true);

  const ratedCard = page.locator(`article[data-movie-id=${JSON.stringify(imdbRated.id)}]`);
  await ratedCard.getByText(`IMDb ${imdbRated.ratings.imdb.toFixed(1)}`, { exact: true }).waitFor();
  const unavailableCard = page.locator(`article[data-movie-id=${JSON.stringify(imdbUnavailable.id)}]`);
  await unavailableCard.getByText("IMDb unavailable", { exact: true }).waitFor();
  assert.equal(await page.getByText(/^Letterboxd (?:unavailable|\d)/).count(), 0);
  assert.equal(await page.getByText("TMDB", { exact: true }).count(), 0);
  const unknownLanguageCard = page.locator(`article[data-movie-id=${JSON.stringify(unknownLanguageMovie.id)}]`);
  await unknownLanguageCard.getByText("Language: Unknown", { exact: true }).waitFor();
  if (knownLanguageMovie) {
    const knownLanguageCard = page.locator(`article[data-movie-id=${JSON.stringify(knownLanguageMovie.id)}]`);
    await knownLanguageCard.getByText(`Language: ${knownLanguageMovie.languages.join(", ")}`, { exact: true }).waitFor();
  }

  const cardFor = (movie) => page.locator(`article[data-movie-id=${JSON.stringify(movie.id)}]`);
  const frameFor = (movie) => cardFor(movie).locator("[data-card-frame]");
  const oneDayOnlyClass = await cardFor(oneDayOnlyMovie).getAttribute("class");
  const dualBorderClass = await cardFor(dualBorderMovie).getAttribute("class");
  const dualFrameClass = await frameFor(dualBorderMovie).getAttribute("class");
  const neutralClass = await cardFor(neutralMovie).getAttribute("class");
  const neutralFrameClass = await frameFor(neutralMovie).getAttribute("class");
  assert.match(oneDayOnlyClass, /border-2/);
  assert.match(oneDayOnlyClass, /border-blue-500\/90/);
  assert.match(dualBorderClass, /border-blue-500\/90/);
  assert.match(dualFrameClass, /border-yellow-400\/90/);
  assert.doesNotMatch(neutralClass, /border-blue-500/);
  assert.match(neutralFrameClass, /border-transparent/);
  assertCompleteDualRings(await ringGeometry(cardFor(dualBorderMovie)));
  assert.equal(await cardFor(oneDayOnlyMovie).getByText("One-day event", { exact: true }).count(), 0);
  assert.equal(await cardFor(dualBorderMovie).getByText("On Film", { exact: true }).count(), 0);
  assert.equal(await cardFor(dualBorderMovie).locator(".sr-only").filter({ hasText: "one-day event" }).count(), 1);
  assert.equal(await cardFor(dualBorderMovie).locator(".sr-only").filter({ hasText: "verified on SceneF On Film" }).count(), 1);

  const cardWidths = await Promise.all(
    [oneDayOnlyMovie, dualBorderMovie, neutralMovie].map(async (movie) => (await cardFor(movie).boundingBox()).width),
  );
  assert.ok(Math.max(...cardWidths) - Math.min(...cardWidths) < 1);
  const posterRatios = await Promise.all(
    [oneDayOnlyMovie, dualBorderMovie, neutralMovie].map(async (movie) => {
      const box = await cardFor(movie).locator("button").first().boundingBox();
      return box.width / box.height;
    }),
  );
  assert.equal(posterRatios.every((ratio) => Math.abs(ratio - (2 / 3)) < 0.01), true);

  await page.getByLabel("Show all hidden").check();
  await page.locator(`article[data-movie-id=${JSON.stringify(onFilmOnlyMovie.id)}]`).waitFor();
  const onFilmOnlyClass = await page.locator(`article[data-movie-id=${JSON.stringify(onFilmOnlyMovie.id)}]`).getAttribute("class");
  const onFilmOnlyFrameClass = await page.locator(`article[data-movie-id=${JSON.stringify(onFilmOnlyMovie.id)}] [data-card-frame]`).getAttribute("class");
  assert.match(onFilmOnlyFrameClass, /border-yellow-400\/90/);
  assert.doesNotMatch(onFilmOnlyClass, /border-blue-500/);
  await page.getByLabel("Show all hidden").uncheck();
  await page.locator("article").first().waitFor();

  const search = page.getByPlaceholder("Search movies and theaters");
  await search.fill(directorSearchTarget.directors[0]);
  assert.equal(await page.locator("article").count(), 0);
  await search.fill(directorSearchTarget.title);
  assert.ok(await page.locator("article").count() > 0);
  await search.fill("");

  const dateNav = page.getByRole("navigation", { name: "Filter showtimes by date" });
  assert.equal(await dateNav.getByRole("button", { name: "All dates" }).getAttribute("aria-pressed"), "true");
  assert.equal(await dateNav.getByRole("button").count(), availableDates.length + 1);
  const selectedTestDate = availableDates.find((date) => {
    const count = defaultPayload.movies.filter((movie) => (
      movie.runs.some((run) => run.dates.some((item) => item.date === date))
    )).length;
    return count > 0 && count < defaultPayload.movies.length;
  });
  assert.ok(selectedTestDate);
  const selectedDateButton = dateNav.getByRole("button", { name: `Show movies playing ${formatDate(selectedTestDate, true)}` });
  await selectedDateButton.click();
  const selectedDateCount = defaultPayload.movies.filter((movie) => (
    movie.runs.some((run) => run.dates.some((item) => item.date === selectedTestDate))
  )).length;
  assert.equal(await page.locator("article").count(), selectedDateCount);
  assert.equal(await selectedDateButton.getAttribute("aria-pressed"), "true");
  await dateNav.getByRole("button", { name: "All dates" }).click();

  await page.getByLabel("On Film only").check();
  assert.equal(await page.locator("article").count(), onFilmMovies.length);
  assert.equal(await page.locator("article[data-on-film='true']").count(), onFilmMovies.length);
  assert.equal(
    await page.locator("article[data-on-film='true'] [data-card-frame]").evaluateAll((frames) => (
      frames.every((frame) => frame.className.includes("border-yellow-400/90"))
    )),
    true,
  );
  await page.getByLabel("On Film only").uncheck();

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
  assert.equal(
    await page.locator("article").evaluateAll((cards) => cards.every((card) => card.className.includes("border-blue-500/90"))),
    true,
  );
  assert.equal(await page.locator("article").getByText("One-day event", { exact: true }).count(), 0);
  await page.getByLabel("Filter by run length").selectOption("multi-day");
  assert.equal(await page.locator("article").count(), multiDayCount);
  await page.getByLabel("Filter by run length").selectOption("all");

  const multiCard = page.locator(`article[data-movie-id=${JSON.stringify(multi.id)}]`);
  assert.equal(
    await multiCard.getByRole("link", { name: `${multi.title} on Letterboxd (opens in a new tab)` }).getAttribute("href"),
    `https://letterboxd.com/tmdb/${multi.tmdbId}/`,
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

  const desktopGridColumns = await page.locator("[data-movie-grid]").evaluate((grid) => (
    getComputedStyle(grid).gridTemplateColumns.split(" ").length
  ));
  const desktopCardBox = await page.locator("article").first().boundingBox();
  const wide = await context.newPage();
  wide.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  wide.on("pageerror", (error) => pageErrors.push(error.message));
  await wide.setViewportSize({ width: 2400, height: 1200 });
  await wide.goto(baseUrl, { waitUntil: "networkidle" });
  const wideGridColumns = await wide.locator("[data-movie-grid]").evaluate((grid) => (
    getComputedStyle(grid).gridTemplateColumns.split(" ").length
  ));
  const wideCardBox = await wide.locator("article").first().boundingBox();
  assert.ok(wideGridColumns > desktopGridColumns);
  assert.ok(wideCardBox.width < desktopCardBox.width);
  assert.ok((await wide.locator("section").first().boundingBox()).width > 2200);
  assertCompleteDualRings(await ringGeometry(
    wide.locator(`article[data-movie-id=${JSON.stringify(dualBorderMovie.id)}]`),
  ));

  const mobile = await context.newPage();
  mobile.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  mobile.on("pageerror", (error) => pageErrors.push(error.message));
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  assertCompleteDualRings(await ringGeometry(
    mobile.locator(`article[data-movie-id=${JSON.stringify(dualBorderMovie.id)}]`),
  ));
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.equal(
    await mobile.getByRole("navigation", { name: "Filter showtimes by date" })
      .evaluate((element) => element.scrollWidth > element.clientWidth),
    true,
  );
  const mobileCardBox = await mobile.locator("article").first().boundingBox();
  assert.equal(Math.round(mobileCardBox.width), 358);

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
    borderStatesAndDimensionsVerified: true,
    completeDualRingsVerifiedAtWidths: [390, 1280, 2400],
    outerAndInnerBorderWidths: "2px each side",
    interRingGap: "3px each side",
    theaterMultiselectUnionCount: unionCount,
    monthDividersValidated: true,
    dateBubbleCount: availableDates.length + 1,
    selectedDateCount,
    onFilmMovieCount: onFilmMovies.length,
    languageCoverage: defaultPayload.movies.filter((movie) => movie.languages.length > 0).length,
    directorOnlySearchResults: 0,
    desktopGridColumns,
    wideGridColumns,
    desktopCardWidth: Math.round(desktopCardBox.width),
    wideCardWidth: Math.round(wideCardBox.width),
    mobileCardWidth: Math.round(mobileCardBox.width),
    imdbRatingCoverage: defaultPayload.movies.filter((movie) => movie.ratings.imdb !== null).length,
    letterboxdAndTmdbRatingsHidden: true,
    dateThenRatingSortVerified: true,
    externalLinkIconsVerified: true,
    hydrationErrors: hydrationErrors.length,
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
  }, null, 2));
} finally {
  await browser.close();
}
