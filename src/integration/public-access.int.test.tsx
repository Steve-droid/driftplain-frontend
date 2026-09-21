import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./msw.setup";
import { Dashboard } from "../pages/Dashboard";
import { Register } from "../pages/Register";
import { apiPost } from "../api/client";
import { chatHistoryFixture, projectsFixture, savingsFixture } from "../test/fixtures";

const BASE = "http://localhost:8000";
let historyCalls: number;
beforeEach(() => {
  historyCalls = 0;
  server.use(
    http.get(`${BASE}/projects`, () => HttpResponse.json(projectsFixture)),
    http.get(`${BASE}/projects/:id/savings`, () => HttpResponse.json(savingsFixture)),
    http.get(`${BASE}/projects/:id/chat`, () => { historyCalls++; return HttpResponse.json(chatHistoryFixture); }),
    http.get(`${BASE}/auth/google/config`, () => HttpResponse.json({ enabled: false })),
  );
});

it("renders an ordinary dashboard without a chatbot or history requests", async () => {
  server.use(http.get(`${BASE}/auth/me`, () => HttpResponse.json({ id: 2, email: "v@example.com", chatEnabled: false })));
  const { container } = render(<Dashboard />);
  await screen.findByText("Cumulative saved");
  expect(historyCalls).toBe(0);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(container.querySelector('[class*="_380px"]')).toBeNull();
});

it("waits for operator capability before fetching chat and hides on revocation", async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((r) => { resolve = r; });
  let enabled = true;
  server.use(http.get(`${BASE}/auth/me`, async () => {
    await pending;
    return HttpResponse.json({ id: 1, email: "operator@example.com", chatEnabled: enabled });
  }));
  render(<Dashboard />);
  await screen.findByText("Cumulative saved");
  expect(historyCalls).toBe(0);
  await act(async () => resolve());
  await waitFor(() => expect(historyCalls).toBe(1));
  expect(await screen.findByRole("textbox")).toBeInTheDocument();
  enabled = false;
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  expect(historyCalls).toBe(1);
});

it("fails closed when capabilities cannot be loaded", async () => {
  server.use(http.get(`${BASE}/auth/me`, () => new HttpResponse(null, { status: 503 })));
  render(<Dashboard />);
  await screen.findByText("Cumulative saved");
  expect(historyCalls).toBe(0);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("shows a full-registration error rather than an email-collision message", async () => {
  const detail = { code: "registration_capacity_reached", message: "Registration is currently full. Existing users can still sign in." };
  server.use(http.post(`${BASE}/auth/register`, () => HttpResponse.json({ detail }, { status: 409 })));
  render(<Register onAuthed={vi.fn()} onSignIn={vi.fn()} />);
  expect(screen.queryByText(/temporary portfolio demo/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "v@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(detail.message);
});

it("preserves the capacity code/message for the Google endpoint too", async () => {
  const detail = { code: "registration_capacity_reached", message: "Registration is currently full. Existing users can still sign in." };
  server.use(http.post(`${BASE}/auth/google`, () => HttpResponse.json({ detail }, { status: 409 })));
  await expect(apiPost("/auth/google", {})).rejects.toMatchObject({ status: 409, code: detail.code, message: detail.message });
});
