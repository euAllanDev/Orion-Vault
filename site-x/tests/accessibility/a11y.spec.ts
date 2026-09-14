import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const workspace = "fieldnote-demo";

async function scan(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).analyze();
  await test.info().attach(`${name}-axe.json`, {
    body: JSON.stringify({ violations: results.violations, incomplete: results.incomplete, passes: results.passes }, null, 2),
    contentType: "application/json"
  });
  expect(results.violations, `${name}: ${results.violations.map((violation) => violation.id).join(", ")}`).toEqual([]);
}

async function login(page: Page, email: string) {
  const before = new Set((await (await fetch("http://127.0.0.1:8025/api/v1/messages")).json()).messages.map((message: { ID: string }) => message.ID));
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page.getByRole("status")).toContainText("Verifique seu email");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const messages = (await (await fetch("http://127.0.0.1:8025/api/v1/messages")).json()).messages;
    const message = messages.find((candidate: { ID: string }) => !before.has(candidate.ID) && JSON.stringify(candidate).includes(email));
    if (message) {
      const body = JSON.stringify(await (await fetch(`http://127.0.0.1:8025/api/v1/message/${message.ID}`)).json()).replaceAll("\\u0026", "&").replaceAll("&amp;", "&");
      const link = body.match(/http:\/\/127\.0\.0\.1:3012\/api\/auth\/callback\/email\?[^\s"<\\]+/)?.[0];
      if (link) {
        await page.goto(link);
        await expect(page).toHaveURL(new RegExp(`/w/${workspace}/dashboard`));
        return;
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error("Magic link not delivered to Mailpit.");
}

test("public pages pass Axe and retain keyboard navigation", async ({ page }) => {
  for (const [path, name] of [["/", "home"], ["/pricing", "pricing"], ["/login", "login"]] as const) {
    await page.goto(path);
    await scan(page, name);
  }
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Pular para conteúdo")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#content")).toBeInViewport();
  await page.goto("/w/fieldnote-demo/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Projetos ativos")).toHaveCount(0);
});

test("authenticated routes, dialogs, forms, and project interactions pass Axe", async ({ page }, testInfo) => {
  const email = testInfo.project.name === "desktop" ? "admin@benchmark.test" : "researcher@benchmark.test";
  const projectName = `Projeto acessível ${testInfo.project.name}`;
  const evidenceText = `Evidência criada por teclado ${testInfo.project.name}.`;
  const editedEvidenceText = `Evidência editada por teclado ${testInfo.project.name}.`;
  await login(page, email);
  for (const [path, name] of [[`/w/${workspace}/dashboard`, "dashboard"], [`/w/${workspace}/projects`, "projects"], [`/w/${workspace}/settings`, "settings"], [`/w/${workspace}/projects/66666666-6666-4666-8666-666666666666`, "project-detail"]] as const) {
    await page.goto(path);
    await page.getByRole("status").waitFor({ state: "detached" }).catch(() => undefined);
    await scan(page, name);
  }
  await page.goto(`/w/${workspace}/projects`);
  const trigger = page.getByRole("button", { name: "Criar projeto" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Criar projeto" });
  await expect(dialog.getByLabel("Nome")).toBeFocused();
  await scan(page, "create-project-dialog");
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByLabel("Nome").fill(projectName);
  await dialog.getByLabel("Objetivo").fill("Fluxo criado por teclado.");
  await dialog.getByRole("button", { name: "Criar projeto" }).press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: projectName })).toBeVisible();
  await page.goto(`/w/${workspace}/projects/66666666-6666-4666-8666-666666666666`);
  const sessionsTab = page.getByRole("tab", { name: "Sessões" });
  await expect(sessionsTab).toHaveAttribute("aria-controls", "sessions-panel");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "sessions-tab");
  await page.getByLabel("Data").fill("2026-10-20T10:00");
  await page.getByLabel("Participante").selectOption({ label: "Participant A · GRANTED" });
  const sessionResponse = page.waitForResponse((response) => response.request().method() === "POST" && /\/api\/v1\/projects\/[^/]+\/sessions$/.test(new URL(response.url()).pathname));
  await page.getByRole("button", { name: "Criar sessão" }).press("Enter");
  expect((await sessionResponse).status()).toBe(201);
  await expect(page.getByText(/20\/10\/2026/).first()).toBeVisible();
  await page.getByRole("tab", { name: "Evidências" }).press("Enter");
  await expect(page.getByLabel("Tipo")).toBeVisible();
  await expect(page.getByLabel("Timestamp em segundos")).toBeVisible();
  await expect(page.getByLabel("Tags separadas por vírgula")).toBeVisible();
  await page.getByLabel("Sessão").selectOption({ index: 1 });
  await page.getByLabel("Texto").fill(evidenceText);
  const evidenceResponse = page.waitForResponse((response) => response.request().method() === "POST" && /\/api\/v1\/sessions\/[^/]+\/evidences$/.test(new URL(response.url()).pathname));
  await page.getByRole("button", { name: "Salvar evidência" }).press("Enter");
  expect((await evidenceResponse).status()).toBe(201);
  const createdEvidence = page.locator(".evidence").filter({ hasText: evidenceText });
  await expect(createdEvidence).toBeVisible();
  await createdEvidence.getByRole("checkbox", { name: "Selecionar" }).check();
  await page.getByRole("tab", { name: "Temas" }).press("Space");
  await expect(page.getByRole("heading", { name: "Criar tema" })).toBeVisible();
  await page.getByLabel("Título").fill("Tema acessível");
  await page.getByLabel("Síntese").fill("Tema criado após seleção de evidência.");
  await page.getByRole("button", { name: /Criar tema com 1 fonte/ }).press("Enter");
  await page.getByRole("tab", { name: "Evidências" }).press("Enter");
  await page.once("dialog", (nativeDialog) => nativeDialog.accept(editedEvidenceText));
  await createdEvidence.getByRole("button", { name: "Editar" }).click();
  const editedEvidence = page.locator(".evidence").filter({ hasText: editedEvidenceText });
  await expect(editedEvidence).toBeVisible();
  await page.once("dialog", (nativeDialog) => nativeDialog.accept());
  await editedEvidence.getByRole("button", { name: "Excluir" }).click();
});

test("mobile menu traps focus, closes with Escape, and returns focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only drawer coverage.");
  await login(page, "owner@benchmark.test");
  await page.goto(`/w/${workspace}/dashboard`);
  const trigger = page.getByRole("button", { name: "Menu" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog.getByRole("link", { name: "Dashboard" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "Configurações" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
