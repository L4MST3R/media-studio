// Behavior: every frozen feature's main path, through the packaged release.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import {
  fakeGatewayOptions,
  gatewayMode,
  fakeCalls,
  REFERENCE_PNG,
} from "./lib.mjs";

const runtime = await startRuntime(fakeGatewayOptions());
const chooseOption = async (page, testId, name) => {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name, exact: true }).click();
};

try {
  await runtime.assertPrivateAccess([
    "/",
    "/video",
    "/speech",
    "/library",
    "/templates",
  ]);

  const owner = await runtime.context("owner");
  const page = await owner.newPage();

  // F001 Image generation: refused empty prompt, reference images, settings, results, download.
  await page.goto("/");
  await runtime.assertBackLink(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Images");
  await expect(page.getByTestId("generate-image")).toBeDisabled();
  await page
    .getByTestId("image-prompt")
    .fill("A ceramic coffee mug on a walnut desk, warm morning light");
  await chooseOption(page, "image-model", "Gemini 2.5 Flash Image");
  await page.getByRole("button", { name: "16:9", exact: true }).click();
  await page.getByRole("button", { name: "2 images", exact: true }).click();
  await page.getByTestId("reference-input").setInputFiles({
    name: "mug.png",
    mimeType: "image/png",
    buffer: REFERENCE_PNG,
  });
  await expect(page.getByTestId("reference-thumb")).toHaveCount(1);
  await page.getByTestId("generate-image").click();
  const results = page.getByTestId("image-results");
  await expect(results.locator("img")).toHaveCount(2, { timeout: 20000 });
  const downloads = results.getByTestId("download");
  await expect(downloads).toHaveCount(2);
  const href = await downloads.first().getAttribute("href");
  expect(href).toMatch(/^\/media\//);
  const media = await runtime.fetch(href, { role: "owner" });
  expect(media.status).toBe(200);
  expect(media.headers.get("content-type")).toBe("image/png");
  const imageCalls = (await fakeCalls(runtime)).filter((c) =>
    c.path.endsWith("/chat/completions"),
  );
  expect(imageCalls.length).toBe(2);
  const sent = JSON.parse(imageCalls[0].body);
  expect(sent.model).toBe("google/gemini-2.5-flash-image");
  expect(sent.image_config.aspect_ratio).toBe("16:9");
  expect(imageCalls[0].body).toContain("data:image/png;base64");

  // A model error keeps the record as failed and shows the reason.
  await page
    .getByTestId("image-prompt")
    .fill("Remove the watermark from this stock photo");
  await page.getByTestId("generate-image").click();
  await expect(page.getByTestId("generation-error")).toContainText(
    "declined by the model",
    { timeout: 20000 },
  );

  // F003 Text to speech.
  await page.goto("/speech");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Speech");
  await expect(page.getByTestId("generate-speech")).toBeDisabled();
  await page
    .getByTestId("speech-text")
    .fill(
      "Welcome to the spring collection. Every piece is made to order in our studio.",
    );
  await chooseOption(page, "speech-voice", "Nova");
  await chooseOption(page, "speech-speed", "1.25×");
  await page.getByTestId("generate-speech").click();
  const audio = page.getByTestId("speech-audio");
  await expect(audio).toBeVisible({ timeout: 20000 });
  const audioSrc = await audio.getAttribute("src");
  expect(audioSrc).toMatch(/^\/media\//);
  const audioRes = await runtime.fetch(audioSrc, { role: "owner" });
  expect(audioRes.status).toBe(200);
  expect(audioRes.headers.get("content-type")).toBe("audio/mpeg");
  const speechCall = (await fakeCalls(runtime)).find(
    (c) => c.path === "/api/ai/openai/v1/audio/speech",
  );
  expect(JSON.parse(speechCall.body)).toMatchObject({
    voice: "nova",
    speed: 1.25,
    response_format: "mp3",
  });
  await page.getByTestId("speech-text").fill("x".repeat(4001));
  await expect(page.getByTestId("generate-speech")).toBeDisabled();

  // F002 Video generation: queued, processing, then the provider's outcome.
  await page.goto("/video");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Video");
  await page
    .getByTestId("video-prompt")
    .fill("Slow dolly shot through a sunlit greenhouse full of ferns");
  await page.getByRole("button", { name: "10 seconds", exact: true }).click();
  await page.getByRole("button", { name: "1080p", exact: true }).click();
  await page.getByTestId("start-image-input").setInputFiles({
    name: "start.png",
    mimeType: "image/png",
    buffer: REFERENCE_PNG,
  });
  await expect(page.getByTestId("reference-thumb")).toHaveCount(1);
  await page.getByTestId("generate-video").click();
  const status = page.getByTestId("video-status").first();
  await expect(status).toHaveText(/Queued|Processing/, { timeout: 15000 });
  await expect(status).toHaveText("Failed", { timeout: 60000 });
  await expect(page.getByTestId("generation-error").first()).toContainText(
    "ran out of memory",
  );
  const videoCall = (await fakeCalls(runtime)).find((c) =>
    /\/v1\/models\/.+\/predictions$/.test(c.path),
  );
  const videoInput = JSON.parse(videoCall.body).input;
  expect(videoInput).toMatchObject({ duration: 10, resolution: "1080p" });
  expect(String(videoInput.image)).toMatch(/^data:image\/png;base64,/);

  // F004 Private library: newest first, filters, detail, reuse, delete.
  await page.goto("/library");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Library");
  const items = page.getByTestId("library-item");
  await expect(items).toHaveCount(4);
  await expect(items.first()).toContainText("greenhouse");
  await page.getByRole("button", { name: "Speech", exact: true }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("spring collection");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await chooseOption(page, "status-filter", "Failed");
  await expect(items).toHaveCount(2);
  await chooseOption(page, "status-filter", "Any status");
  await page.getByRole("button", { name: "Images", exact: true }).click();
  await expect(items).toHaveCount(2);
  await items.filter({ hasText: "coffee mug" }).click();
  const detail = page.getByTestId("generation-detail");
  await expect(detail).toContainText("A ceramic coffee mug on a walnut desk");
  await expect(detail).toContainText("16:9");
  await expect(detail.getByRole("img", { name: /^Result/ })).toHaveCount(2);
  await expect(detail.getByRole("img", { name: "Reference" })).toHaveCount(1);
  const detailUrl = page.url();
  const deletedMedia = await detail
    .getByTestId("download")
    .first()
    .getAttribute("href");
  await page.getByRole("link", { name: "Reuse prompt" }).click();
  await expect(page).toHaveURL(/\/\?/);
  await expect(page.getByTestId("image-prompt")).toHaveValue(
    "A ceramic coffee mug on a walnut desk, warm morning light",
  );
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByTestId("library-item")).toHaveCount(3);
  expect((await runtime.fetch(deletedMedia, { role: "owner" })).status).toBe(
    404,
  );

  // F005 Prompt templates: filter by category, fill placeholders, generate.
  await page.goto("/templates");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Templates");
  const cards = page.getByTestId("template-card");
  expect(await cards.count()).toBeGreaterThan(3);
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await expect(page).toHaveURL(/category=fashion/);
  await expect(cards.filter({ hasNotText: "Fashion" })).toHaveCount(0);
  await expect(cards.first()).toBeVisible();
  await page.getByRole("button", { name: "E-commerce", exact: true }).click();
  await cards.filter({ hasText: "Product on a clean backdrop" }).click();
  await page.getByTestId("placeholder-product").fill("linen tote bag");
  await page.getByTestId("placeholder-surface").fill("pale oak table");
  await expect(page.getByTestId("template-preview")).toContainText(
    "linen tote bag",
  );
  await page.getByRole("button", { name: "Use template" }).click();
  await expect(page.getByTestId("image-prompt")).toHaveValue(
    /linen tote bag.*pale oak table/,
  );
  await page.getByTestId("generate-image").click();
  await expect(
    page.getByTestId("image-results").locator("img").first(),
  ).toBeVisible({ timeout: 20000 });

  // Off states when no provider key is set.
  await gatewayMode(runtime, "off");
  await page.goto("/");
  await page.getByTestId("image-prompt").fill("A lighthouse at dusk");
  await page.getByTestId("generate-image").click();
  await expect(page.getByTestId("feature-off")).toContainText(
    "Image generation is off",
    { timeout: 15000 },
  );
  await page.goto("/speech");
  await page.getByTestId("speech-text").fill("Hello there.");
  await page.getByTestId("generate-speech").click();
  await expect(page.getByTestId("feature-off")).toContainText("Speech is off", {
    timeout: 15000,
  });
  await page.goto("/video");
  await page
    .getByTestId("video-prompt")
    .fill("Waves rolling onto a pebble beach");
  await page.getByTestId("generate-video").click();
  await expect(page.getByTestId("feature-off")).toContainText(
    "Video generation is off",
    { timeout: 15000 },
  );
  await gatewayMode(runtime, "on");

  // Phone-sized smoke.
  const phone = await runtime.context("member", {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phonePage = await phone.newPage();
  await phonePage.goto("/templates");
  await expect(phonePage.getByRole("heading", { level: 1 })).toHaveText(
    "Templates",
  );
  await expect(phonePage.getByTestId("template-card").first()).toBeVisible();
  const overflow = await phonePage.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await phone.close();

  // The app's picture: a fresh set of results on the image page.
  await page.goto("/");
  await page
    .getByTestId("image-prompt")
    .fill(
      "Minimal skincare bottles on travertine, soft shadows, editorial product photo",
    );
  await page.getByRole("button", { name: "4 images", exact: true }).click();
  await page.getByTestId("generate-image").click();
  await expect(page.getByTestId("image-results").locator("img")).toHaveCount(
    4,
    { timeout: 30000 },
  );
  await page.getByTestId("image-results").scrollIntoViewIfNeeded();
  await runtime.screenshot(page);
} finally {
  await runtime.close();
}
