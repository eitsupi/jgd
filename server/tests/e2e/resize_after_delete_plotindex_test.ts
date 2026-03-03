/**
 * Regression test: resize after deleting the latest plot must use plotIndex.
 *
 * After deleting the latest plot, R's display list still holds the deleted
 * plot.  A normal resize replays the DL → sends back the deleted plot →
 * browser blocks it via latestDeleted guard → remaining plot is never resized.
 *
 * Fix: when latestDeleted is true, the browser must send plotIndex so R
 * replays the correct snapshot for the remaining plot.
 *
 * This test verifies:
 *  1. After delete-latest + resize, R receives plotIndex in the resize message.
 *  2. R's plotIndex response (resized snapshot) is accepted by the browser and
 *     the remaining plot is updated.
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import { TestServer } from "../helpers/server.ts";
import { RClient } from "../helpers/r_client.ts";
import { E2EBrowser, readOfType, sampleCanvasColors, waitForPlotInfo } from "../helpers/e2e_browser.ts";
import { delay } from "@std/async";
import type { ResizeMessage } from "../helpers/types.ts";

Deno.test("E2E: resize after delete-latest sends plotIndex and accepts R response", async (t) => {
  const server = new TestServer();
  const rClient = new RClient();
  const e2e = new E2EBrowser();

  try {
    await server.start();
    await rClient.connect(server.socketPath);
    await e2e.launch();

    const page = await e2e.newPage(server.httpBaseUrl);
    // Consume the initial resize from browser connect
    await rClient.readMessage<ResizeMessage>();

    // Frame 1: entirely RED (simulates plot(1:10))
    await rClient.sendFrame({
      ops: [{ op: "rect", x0: 0, y0: 0, x1: 400, y1: 300, gc: { fill: "#ff0000" } }],
      device: { width: 400, height: 300, bg: "#ff0000" },
    }, { newPage: true });
    await waitForPlotInfo(page, "1 / 1");

    // Frame 2: entirely BLUE (simulates hist(rnorm(100)))
    await rClient.sendFrame({
      ops: [{ op: "rect", x0: 0, y0: 0, x1: 400, y1: 300, gc: { fill: "#0000ff" } }],
      device: { width: 400, height: 300, bg: "#0000ff" },
    }, { newPage: true });
    await waitForPlotInfo(page, "2 / 2");

    await t.step("delete latest (blue) plot", async () => {
      await page.evaluate(`document.getElementById('btn-delete').click()`);
      await waitForPlotInfo(page, "1 / 1");
      const colors = await sampleCanvasColors(page);
      assertEquals(colors.hasRed, true, "remaining plot should be red");
      assertEquals(colors.hasBlue, false, "deleted blue plot should be gone");
    });

    // Capture the resize dimensions R receives so we can reply with matching dims
    let resizeWidth = 0;
    let resizeHeight = 0;

    await t.step("resize sends plotIndex for remaining plot", async () => {
      // Trigger ResizeObserver by changing container size
      await page.evaluate(`(function() {
        var c = document.getElementById('canvas-container');
        c.style.width = '600px';
        c.style.height = '450px';
      })()`);

      // Read resize message from R — it should include plotIndex=0
      const msg = await readOfType<ResizeMessage>(
        rClient, "resize", 5000,
      );
      resizeWidth = msg.width;
      resizeHeight = msg.height;

      assertNotEquals(
        msg.plotIndex,
        undefined,
        "resize after delete-latest must include plotIndex",
      );
      assertEquals(
        msg.plotIndex,
        0,
        "plotIndex should be 0 (the remaining first plot)",
      );
    });

    await t.step("R plotIndex response updates the remaining plot", async () => {
      // R replays snapshot[0] (RED) at the dimensions from the resize message
      await rClient.sendFrame({
        ops: [{ op: "rect", x0: 0, y0: 0, x1: resizeWidth, y1: resizeHeight, gc: { fill: "#ff0000" } }],
        device: { width: resizeWidth, height: resizeHeight, bg: "#ff0000" },
      });
      // Wait for browser to process the frame
      await delay(500);

      const info = await page.evaluate(
        `document.getElementById('plot-info').textContent`,
      ) as string;
      assertEquals(info, "1 / 1", "plot count should still be 1");

      const colors = await sampleCanvasColors(page);
      assertEquals(colors.hasRed, true, "canvas should show resized red plot");
      assertEquals(colors.hasBlue, false, "deleted blue plot must not appear");
    });

  } finally {
    await e2e.close();
    rClient.close();
    await delay(100);
    await server.shutdown();
    server.cleanup();
  }
});
