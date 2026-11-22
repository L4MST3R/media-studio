// Authorization: who may open what, ownership of generations and files,
// admin-only template management, and no sign-in of the app's own.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import {
  fakeGatewayOptions,
  REFERENCE_PNG,
  captureServerFnPost,
  replayAs,
} from "./lib.mjs";

const runtime = await startRuntime(fakeGatewayOptions());
try {
  // Anonymous and outsider are refused; members get in.
  await runtime.assertPrivateAccess([
    "/",
    "/video",
    "/speech",
    "/library",
    "/templates",
  ]);
  // No public routes at all.
  expect(runtime.manifest.public ?? []).toEqual([]);
  for (const path of [
    "/media/x/0",
    "/uploads/x",
    "/library/x",
    "/templates/x",
  ]) {
    for (const role of [undefined, "outsider"]) {
      const res = await runtime.fetch(path, role ? { role } : {});
      expect([401, 403]).toContain(res.status);
    }
  }
  const anonUpload = await runtime.fetch("/uploads", {
    method: "POST",
    headers: { "content-type": "image/png" },
    body: REFERENCE_PNG,
  });
  expect([401, 403]).toContain(anonUpload.status);

  // The app serves no sign-in page of its own.
  for (const path of [
    "/login",
    "/signin",
    "/sign-in",
    "/signup",
    "/register",
    "/logout",
  ]) {
    const res = await runtime.fetch(path, { role: "member" });
    expect(res.status).toBe(404);
  }
  const home = await (await runtime.fetch("/", { role: "member" })).text();
  expect(home).not.toMatch(/type="password"/i);

  // The owner makes an image with a reference upload.
  const ownerCtx = await runtime.context("owner");
  const ownerPage = await ownerCtx.newPage();
  await ownerPage.goto("/");
  await ownerPage
    .getByTestId("image-prompt")
    .fill("Private moodboard: brass desk lamp on linen");
  await ownerPage.getByTestId("reference-input").setInputFiles({
    name: "lamp.png",
    mimeType: "image/png",
    buffer: REFERENCE_PNG,
  });
  const thumb = ownerPage.getByTestId("reference-thumb").locator("img");
  await expect(thumb).toHaveCount(1);
  const uploadSrc = await thumb.getAttribute("src");
  expect(uploadSrc).toMatch(/^\/uploads\//);
  await ownerPage.getByTestId("generate-image").click();
  await expect(
    ownerPage.getByTestId("image-results").locator("img"),
  ).toHaveCount(1, { timeout: 20000 });
  const mediaHref = await ownerPage
    .getByTestId("image-results")
    .getByTestId("download")
    .first()
    .getAttribute("href");
  const db = await runtime.database();
  const row = await db
    .prepare(
      "select id from generations where prompt like 'Private moodboard%'",
    )
    .first();
  expect(row?.id).toBeTruthy();

  // Another member can't see, fetch or delete the owner's work.
  expect((await runtime.fetch(mediaHref, { role: "owner" })).status).toBe(200);
  expect((await runtime.fetch(mediaHref, { role: "member" })).status).toBe(404);
  expect((await runtime.fetch(uploadSrc, { role: "owner" })).status).toBe(200);
  expect((await runtime.fetch(uploadSrc, { role: "member" })).status).toBe(404);
  const memberCtx = await runtime.context("member");
  const memberPage = await memberCtx.newPage();
  await memberPage.goto("/library");
  await expect(memberPage.getByRole("heading", { level: 1 })).toHaveText(
    "Library",
  );
  await expect(memberPage.getByText("Private moodboard")).toHaveCount(0);
  await expect(memberPage.getByTestId("library-item")).toHaveCount(0);
  await memberPage.goto(`/library/${row.id}`);
  await expect(memberPage.getByTestId("not-found")).toBeVisible();
  await expect(memberPage.getByText("Private moodboard")).toHaveCount(0);

  // The member replays the owner's delete call: the owner's record stays.
  await ownerPage.goto(`/library/${row.id}`);
  await ownerPage.getByRole("button", { name: "Delete" }).click();
  const deleteCall = await captureServerFnPost(ownerPage, () =>
    ownerPage
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click(),
  );
  const replayedGen = await replayAs(memberPage, deleteCall);
  expect(replayedGen.ok && !/error/i.test(replayedGen.text)).toBe(false);
  expect(
    await db
      .prepare("select id from generations where id = ?")
      .bind(row.id)
      .first(),
  ).toBeTruthy();
  expect((await runtime.fetch(mediaHref, { role: "owner" })).status).toBe(200);
  // The same call from the owner deletes the record and its files.
  await ownerPage.goto("/library");
  expect((await replayAs(ownerPage, deleteCall)).ok).toBe(true);
  expect(
    await db
      .prepare("select id from generations where id = ?")
      .bind(row.id)
      .first(),
  ).toBeNull();
  expect((await runtime.fetch(mediaHref, { role: "owner" })).status).toBe(404);

  // Templates: members read, only admins create, edit or delete.
  await memberPage.goto("/templates");
  await expect(memberPage.getByTestId("template-card").first()).toBeVisible();
  await expect(
    memberPage.getByRole("button", { name: "New template" }),
  ).toHaveCount(0);
  await memberPage.getByTestId("template-card").first().click();
  await expect(memberPage.getByTestId("template-preview")).toBeVisible();
  await expect(memberPage.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(memberPage.getByRole("button", { name: "Delete" })).toHaveCount(
    0,
  );

  const before = (
    await db.prepare("select count(*) as n from templates").first()
  ).n;
  await ownerPage.goto("/templates");
  await ownerPage.getByRole("button", { name: "New template" }).click();
  const dialog = ownerPage.getByRole("dialog");
  await dialog.getByTestId("template-title").fill("Team headshot");
  await dialog
    .getByTestId("template-prompt")
    .fill("A professional headshot of {person} against a {color} backdrop");
  const createCall = await captureServerFnPost(ownerPage, () =>
    dialog.getByRole("button", { name: "Save" }).click(),
  );
  const replayed = await replayAs(memberPage, createCall);
  expect(replayed.ok && !/error/i.test(replayed.text)).toBe(false);
  expect(
    (await db.prepare("select count(*) as n from templates").first()).n,
  ).toBe(before);

  // The same call from the owner, an admin, goes through; the member then sees it.
  await ownerPage.goto("/templates");
  const ownCreate = await replayAs(ownerPage, createCall);
  expect(ownCreate.ok).toBe(true);
  expect(
    (await db.prepare("select count(*) as n from templates").first()).n,
  ).toBe(before + 1);
  await memberPage.goto("/templates");
  await expect(
    memberPage
      .getByTestId("template-card")
      .filter({ hasText: "Team headshot" }),
  ).toHaveCount(1);
  const created = await db
    .prepare("select id from templates where title = 'Team headshot'")
    .first();

  // The member replays the owner's delete of that template: it stays.
  await ownerPage.goto(`/templates/${created.id}`);
  await ownerPage.getByRole("button", { name: "Delete" }).click();
  const deleteTemplate = await captureServerFnPost(ownerPage, () =>
    ownerPage
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click(),
  );
  const replayedDelete = await replayAs(memberPage, deleteTemplate);
  expect(replayedDelete.ok && !/error/i.test(replayedDelete.text)).toBe(false);
  expect(
    await db
      .prepare("select id from templates where id = ?")
      .bind(created.id)
      .first(),
  ).toBeTruthy();
  await ownerPage.goto("/templates");
  expect((await replayAs(ownerPage, deleteTemplate)).ok).toBe(true);
  expect(
    await db
      .prepare("select id from templates where id = ?")
      .bind(created.id)
      .first(),
  ).toBeNull();
} finally {
  await runtime.close();
}
