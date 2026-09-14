import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mountRuntime } from "./markdown-runtime-harness";

describe("memo content lazy renderers", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("renders KaTeX when math syntax is present", async () => {
    const runtime = await mountRuntime("$L$");
    runtimes.push(runtime);
    await waitFor(() => expect(runtime.root.querySelector(".katex")).not.toBeNull());
  });
});
