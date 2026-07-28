import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { createConnection } from "./db/index.js";
import { createApp } from "./app.js";

describe("createApp", () => {
  it("serves the hello world root route", async () => {
    const db = createConnection(":memory:");
    const app = createApp(db);
    const response = await supertest(app).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toBe("Hello World!");
  });
});
