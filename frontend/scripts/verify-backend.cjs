/* eslint-disable @typescript-eslint/no-require-imports -- Node CLI loads Playwright from the configured runtime. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const email = process.env.TEST_EMAIL;
  if (!email && !process.env.SCREENSHOTS_ONLY) throw new Error("Set TEST_EMAIL to a unique disposable test account.");
  const output = path.resolve(__dirname, "../../.local/verification");
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Partnership overview" }).waitFor({ timeout: 60000 });
    const demo = await context.request.get("http://localhost:3000/api/demo");
    assert.equal(demo.status(), 200);
    const data = await demo.json();
    assert.equal(data.creators.length, 6);
    assert.equal(data.campaigns.length, 3);
    assert.equal(data.results.length, 3);
    assert.equal(data.creators[0].content.length, 4);
    assert.equal(data.creators[0].ideas.length, 2);
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => Array.from(document.images).every((image) => image.naturalWidth > 0)), true, "Sample media failed to load.");
    assert.equal(await page.locator(".co-sidebar").evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(32, 32, 32)");
    const primary = page.locator(".co-primary").first();
    await primary.hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".co-primary")).transform === "matrix(1, 0, 0, 1, 0, -2)");
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await primary.evaluate((element) => getComputedStyle(element).transitionDuration), "0s");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(output, "company-desktop.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator(".lx-spotlight").evaluate((panel) => {
      const body = panel.querySelector(".lx-spotlight-body");
      return body.getBoundingClientRect().bottom <= panel.getBoundingClientRect().bottom + 1;
    }), true, "Mobile profile details are clipped.");
    await page.screenshot({ path: path.join(output, "company-mobile.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByLabel("Workspace role").selectOption("creator");
    await page.getByRole("heading", { name: data.creators[0].name, exact: true }).waitFor();
    await page.getByRole("button", { name: "Content", exact: true }).click();
    assert.equal(await page.locator("tbody tr").count(), 3);
    await page.getByRole("button", { name: "Ideas", exact: true }).click();
    await page.getByRole("heading", { name: data.creators[0].ideas[0].title }).waitFor();
    await page.screenshot({ path: path.join(output, "creator-ideas.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, "creator-mobile.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (process.env.SCREENSHOTS_ONLY) { console.log("Stable desktop/mobile screenshots captured."); return; }
    await page.getByRole("button", { name: "Company workspace", exact: true }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Create account", exact: true }).click();
    await dialog.getByLabel("Your name").fill("Backend Verification");
    await dialog.getByLabel("Company name").fill("Verification Studio");
    await dialog.getByLabel("Email", { exact: true }).fill(email);
    await dialog.getByLabel("Password", { exact: true }).fill("Test-only-Password-731!");
    await dialog.getByRole("button", { name: "Create account", exact: true }).last().click();
    await dialog.waitFor({ state: "hidden", timeout: 60000 });
    await page.locator(".co-company strong").filter({ hasText: "Verification Studio" }).waitFor();
    await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
    await page.getByRole("button", { name: "Load sample campaigns" }).click();
    await page.getByText("Sample campaigns loaded into your company workspace.").waitFor();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.getByRole("button", { name: `Shortlist ${data.creators[0].name}`, exact: true }).first().click();
    await page.locator(".co-nav").filter({ hasText: "Shortlist" }).locator("span").filter({ hasText: "1" }).waitFor();
    await page.reload();
    await page.locator(".co-nav").filter({ hasText: "Shortlist" }).locator("span").filter({ hasText: "1" }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Create campaign", exact: true }).first().click();
    await page.getByLabel("Campaign name", { exact: true }).fill("Persistence verification");
    await page.getByLabel("Campaign brief", { exact: true }).fill("Temporary campaign for end-to-end database verification.");
    await page.getByLabel("Start date", { exact: true }).fill("2026-10-10");
    await page.getByLabel("End date", { exact: true }).fill("2026-10-20");
    await page.getByLabel("Deliverables", { exact: true }).fill("One sample reel");
    await page.getByRole("button", { name: "Save campaign draft" }).click();
    await page.getByRole("heading", { name: "Persistence verification", exact: true }).waitFor();
    await page.getByLabel("Campaign status", { exact: true }).selectOption("Active");
    await page.waitForResponse((response) => response.url().includes("/workspace/snapshot") && response.status() === 200);
    await page.reload();
    await page.getByRole("heading", { name: "Persistence verification", exact: true }).waitFor();
    assert.equal(await page.getByLabel("Campaign status", { exact: true }).inputValue(), "Active");
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(JSON.stringify({ passed: true, email, checks: ["backend sample data", "desktop/mobile", "creator content and ideas", "registration/session cookie", "company seeding", "shortlist persistence", "campaign persistence"] }));
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
