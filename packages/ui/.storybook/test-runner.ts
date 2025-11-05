import type { TestRunnerConfig } from "@storybook/test-runner";
import { injectAxe, checkA11y } from "axe-playwright";
import { expect } from "@storybook/test-runner";

const config: TestRunnerConfig = {
  setup: async ({ page }) => {
    await injectAxe(page);
  },
  postRender: async ({ page, context }) => {
    await checkA11y(page, "#storybook-root");
    const screenshot = await page.screenshot({
      fullPage: false,
      animations: "disabled",
    });
    await expect(screenshot).toMatchSnapshot(`${context.id}.png`, {
      maxDiffPixelRatio: 0.02,
    });
  },
};

export default config;
