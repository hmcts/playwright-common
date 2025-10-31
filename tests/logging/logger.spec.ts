import { PassThrough } from "stream";
import { afterEach, describe, expect, it } from "vitest";
import { transports as winstonTransports } from "winston";
import { createLogger } from "../../src/logging/logger.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("createLogger", () => {
  it("redacts sensitive metadata by default", async () => {
    const stream = new PassThrough();
    const logs: string[] = [];
    stream.on("data", (chunk) => logs.push(chunk.toString("utf-8")));

    const logger = createLogger({
      format: "json",
      transports: [new winstonTransports.Stream({ stream })],
    });

    logger.info("Fetching token", {
      token: "super-secret-token",
      detail: { password: "hunter2" },
    });

    await flush();

    const output = logs.join("");
    expect(output).toContain('"token":"[REDACTED]"');
    expect(output).toContain('"password":"[REDACTED]"');
  });

  it("allows redaction to be disabled via env", async () => {
    process.env.LOG_REDACTION = "off";
    const stream = new PassThrough();
    const logs: string[] = [];
    stream.on("data", (chunk) => logs.push(chunk.toString("utf-8")));

    const logger = createLogger({
      format: "json",
      transports: [new winstonTransports.Stream({ stream })],
    });

    logger.info("Fetching token", { token: "super-secret-token" });
    await flush();
    const output = logs.join("");
    expect(output).toContain('"token":"super-secret-token"');
  });
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
