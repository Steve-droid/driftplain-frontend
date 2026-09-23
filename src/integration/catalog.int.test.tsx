import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http, delay } from "msw";
import { beforeEach, expect, it } from "vitest";
import { server } from "./msw.setup";
import { App } from "../App";
import { config } from "../config";
import { benchmark, model, observation, page } from "../catalog/fixtures";
import { catalog } from "../catalog/api";
import { setToken } from "../api/client";
const base = `${config.apiBaseUrl}/catalog/v1`;
beforeEach(() => {
  window.history.replaceState(null, "", "/benchmarks");
  server.use(
    http.get(`${base}/benchmarks`, () => HttpResponse.json(page([benchmark]))),
  );
});
it("omits credentials and Authorization even with an expired stored token", async () => {
  setToken("expired");
  let auth: string | null | undefined;
  let credentials: string | undefined;
  server.use(
    http.get(`${base}/models`, ({ request }) => {
      auth = request.headers.get("authorization");
      credentials = request.credentials;
      return HttpResponse.json(page([model]));
    }),
  );
  expect((await catalog<{ items: unknown[] }>("models")).items).toHaveLength(1);
  expect(auth).toBeNull();
  expect(credentials).toBe("omit");
});
it("cancels stale typeahead results and shows a real empty state", async () => {
  server.use(
    http.get(`${base}/search`, async ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("q") === "old") {
        await delay(500);
        return HttpResponse.json(
          page([
            { type: "model", id: 77, name: "Stale model", subtitle: null },
          ]),
        );
      }
      return HttpResponse.json(page([]));
    }),
  );
  render(<App />);
  const input = screen.getByRole("combobox", {
    name: "Search models or benchmarks",
  });
  fireEvent.change(input, { target: { value: "old" } });
  await new Promise((resolve) => setTimeout(resolve, 250));
  fireEvent.change(input, { target: { value: "no-match" } });
  await screen.findByText("No matching models or benchmarks.");
  await new Promise((resolve) => setTimeout(resolve, 550));
  expect(
    screen.queryByRole("option", { name: "Stale model" }),
  ).not.toBeInTheDocument();
});
it("uses opaque server pagination and keeps the query in the URL", async () => {
  window.history.replaceState(null, "", "/models?q=alpha");
  server.use(
    http.get(`${base}/models`, ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get("q")).toBe("alpha");
      return HttpResponse.json(
        url.searchParams.get("cursor")
          ? page([{ ...model, id: 42, name: "Alpha 42" }])
          : page([model], "opaque+page/2="),
      );
    }),
  );
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Next page" }));
  await screen.findByRole("link", { name: "Alpha 42" });
  expect(new URLSearchParams(window.location.search).get("cursor")).toBe(
    "opaque+page/2=",
  );
  expect(
    screen.queryByRole("link", { name: "Alpha 1" }),
  ).not.toBeInTheDocument();
});
it("renders reported zero and missing values differently through the wire contract", async () => {
  window.history.replaceState(null, "", "/evidence");
  server.use(
    http.get(`${base}/observations`, () =>
      HttpResponse.json(
        page([
          {
            ...observation,
            modelId: null,
            metrics: [{ ...observation.metrics[0], value: "0" }],
          },
          {
            ...observation,
            id: 2,
            modelId: null,
            sourceModelLabel: "Missing label",
            metrics: [
              {
                ...observation.metrics[0],
                value: null,
                missingReason: "Not measured",
              },
            ],
          },
        ]),
      ),
    ),
  );
  render(<App />);
  expect((await screen.findAllByText("0%")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Not reported").length).toBeGreaterThan(0);
  await waitFor(() =>
    expect(screen.getAllByText("Unresolved source label")).toHaveLength(2),
  );
});
