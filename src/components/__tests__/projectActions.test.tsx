import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProjectActions } from "../ProjectActions";
import {
  projectsFixture,
  ciSetupFixture,
} from "../../test/fixtures";

vi.mock("../../api/projects", () => ({
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));
import { deleteProject, updateProject } from "../../api/projects";
vi.mock("../../api/jenkins", () => ({ getJenkins: vi.fn(), connectJenkins: vi.fn() }));
import { connectJenkins, getJenkins } from "../../api/jenkins";
vi.mock("../../api/recommend", () => ({ postRecommendation: vi.fn() }));
import { postRecommendation } from "../../api/recommend";
vi.mock("../../api/ci", () => ({ getCiSetup: vi.fn(), rotateCiToken: vi.fn() }));
import { getCiSetup, rotateCiToken } from "../../api/ci";
import { ApiError } from "../../api/client";

const project = projectsFixture[0]; // id 1, "acme-api", setupComplete: true

beforeEach(() => {
  vi.mocked(updateProject).mockReset();
  vi.mocked(deleteProject).mockReset();
  vi.mocked(getJenkins).mockReset();
  vi.mocked(connectJenkins).mockReset();
  vi.mocked(postRecommendation).mockReset();
  vi.mocked(getCiSetup).mockReset();
  vi.mocked(rotateCiToken).mockReset();
});

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /ci-agent actions/i }));
}

describe("ProjectActions", () => {
  it("opens a menu with edit / re-pick / delete", () => {
    render(<ProjectActions project={project} onChanged={vi.fn()} onDeleted={vi.fn()} />);
    openMenu();
    expect(screen.getByRole("menuitem", { name: /edit jenkins/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /re-pick model/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete ci-agent/i })).toBeInTheDocument();
  });

  it("deletes after confirmation and hands the id back via onDeleted", async () => {
    vi.mocked(deleteProject).mockResolvedValue();
    const onDeleted = vi.fn();
    render(<ProjectActions project={project} onChanged={vi.fn()} onDeleted={onDeleted} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /delete ci-agent/i }));
    // confirm dialog
    expect(screen.getByText(/permanently removes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^delete ci-agent$/i }));

    await waitFor(() => expect(deleteProject).toHaveBeenCalledWith(1));
    expect(onDeleted).toHaveBeenCalledWith(1);
  });

  it("edits the Jenkins connection (prefilled) and PUTs the change", async () => {
    vi.mocked(getJenkins).mockResolvedValue({
      projectId: 1,
      baseUrl: "http://old.jenkins",
      jobName: "old/job",
      status: "configured",
    });
    vi.mocked(connectJenkins).mockResolvedValue({
      projectId: 1,
      baseUrl: "http://new.jenkins",
      jobName: "old/job",
      status: "configured",
    });
    const onChanged = vi.fn();
    render(<ProjectActions project={project} onChanged={onChanged} onDeleted={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /edit jenkins/i }));

    // prefilled from getJenkins
    const urlInput = await screen.findByLabelText("Jenkins base URL");
    expect(urlInput).toHaveValue("http://old.jenkins");

    fireEvent.change(urlInput, { target: { value: "http://new.jenkins" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(connectJenkins).toHaveBeenCalledWith(1, {
        baseUrl: "http://new.jenkins",
        jobName: "old/job",
      }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows Bedrock IAM guidance when editing a Nova project", async () => {
    const novaProject = {
      ...project,
      selectedOptionModel: "Nova 2 Lite",
    };
    vi.mocked(getJenkins).mockResolvedValue({
      projectId: 1,
      baseUrl: "http://old.jenkins",
      jobName: "old/job",
      status: "configured",
    });

    render(<ProjectActions project={novaProject} onChanged={vi.fn()} onDeleted={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /edit jenkins/i }));

    await screen.findByLabelText("Jenkins base URL");
    expect(screen.queryByText("modelmatch-model-api-key")).not.toBeInTheDocument();
    expect(screen.getByText("modelmatch-ci-token")).toBeInTheDocument();
    expect(screen.getByText(/do not add modelmatch-model-api-key/i)).toBeInTheDocument();
  });

  it("surfaces a non-404 failure to load the Jenkins connection (no blank form)", async () => {
    vi.mocked(getJenkins).mockRejectedValue(new ApiError(500, "db down"));
    render(<ProjectActions project={project} onChanged={vi.fn()} onDeleted={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /edit jenkins/i }));
    expect(await screen.findByText("db down")).toBeInTheDocument();
    expect(screen.queryByLabelText("Jenkins base URL")).not.toBeInTheDocument();
  });

  it("opens CI setup & token directly, exposing token regeneration", async () => {
    vi.mocked(getCiSetup).mockResolvedValue(ciSetupFixture);
    render(<ProjectActions project={project} onChanged={vi.fn()} onDeleted={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /ci setup & token/i }));
    expect(await screen.findByText(/Jenkins stage/i)).toBeInTheDocument();
  });

  it("finishes setup for an incomplete project — Edit Jenkins continues into CI setup", async () => {
    const incomplete = { ...project, setupComplete: false };
    vi.mocked(getJenkins).mockResolvedValue({
      projectId: 1,
      baseUrl: "http://jenkins.local",
      jobName: "acme/main",
      status: "configured",
    });
    vi.mocked(connectJenkins).mockResolvedValue({
      projectId: 1,
      baseUrl: "http://jenkins.local",
      jobName: "acme/main",
      status: "configured",
    });
    vi.mocked(getCiSetup).mockResolvedValue(ciSetupFixture);
    const onChanged = vi.fn();
    render(<ProjectActions project={incomplete} onChanged={onChanged} onDeleted={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /edit jenkins/i }));
    await screen.findByLabelText("Jenkins base URL");
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    // does NOT close — continues into CI setup (the missing token + snippet)
    await waitFor(() => expect(connectJenkins).toHaveBeenCalled());
    expect(await screen.findByText(/shown once/i)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();

    // finishing CI setup closes + refreshes
    fireEvent.click(screen.getByRole("button", { name: /go to dashboard/i }));
    expect(onChanged).toHaveBeenCalled();
  });

  it("routes legacy re-picks to explicit selection without mutating the project", () => {
    render(<ProjectActions project={project} onChanged={vi.fn()} onDeleted={vi.fn()} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /re-pick model/i }));
    expect(window.location.pathname + window.location.search).toBe("/setup?project=1");
    expect(postRecommendation).not.toHaveBeenCalled();
    expect(updateProject).not.toHaveBeenCalled();
    expect(screen.queryByText("Get recommendation")).not.toBeInTheDocument();
  });
});
