// Persistence: generations, their files and templates survive a restart.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { fakeGatewayOptions } from "./lib.mjs";

const runtime = await startRuntime(fakeGatewayOptions());
try {
  let page = await (await runtime.context("owner")).newPage();
  await page.goto("/");
  await page
    .getByTestId("image-prompt")
    .fill("Hand-thrown stoneware bowls stacked on a linen cloth");
  await page.getByTestId("generate-image").click();
  await expect(page.getByTestId("image-results").locator("img")).toHaveCount(
    1,
    { timeout: 20000 },
  );
  const href = await page
    .getByTestId("image-results")
    .getByTestId("download")
    .first()
    .getAttribute("href");

  await page.goto("/templates");
  await page.getByRole("button", { name: "New template" }).click();
  await page
    .getByRole("dialog")
    .getByTestId("template-title")
    .fill("Seasonal window display");
  await page
    .getByRole("dialog")
    .getByTestId("template-prompt")
    .fill("A shop window dressed for {season} with {product}");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(
    page
      .getByTestId("template-card")
      .filter({ hasText: "Seasonal window display" }),
  ).toHaveCount(1);

  await runtime.restart();

  page = await (await runtime.context("owner")).newPage();
  await page.goto("/library");
  await expect(
    page.getByTestId("library-item").filter({ hasText: "stoneware bowls" }),
  ).toHaveCount(1);
  const media = await runtime.fetch(href, { role: "owner" });
  expect(media.status).toBe(200);
  expect(media.headers.get("content-type")).toBe("image/png");
  await page.goto("/templates");
  await expect(
    page
      .getByTestId("template-card")
      .filter({ hasText: "Seasonal window display" }),
  ).toHaveCount(1);
} finally {
  await runtime.close();
}
