import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toolbar } from "./Toolbar";

function setup(overrides: Partial<React.ComponentProps<typeof Toolbar>> = {}) {
  const onSearch = vi.fn();
  const onMode = vi.fn();
  render(
    <Toolbar
      projectName="Project Blueprint"
      search=""
      onSearch={onSearch}
      mode="current"
      onMode={onMode}
      changeCount={3}
      warningCount={1}
      {...overrides}
    />,
  );
  return { onSearch, onMode };
}

describe("Toolbar", () => {
  it("emits typed search text", () => {
    const { onSearch } = setup();
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "auth" } });
    expect(onSearch).toHaveBeenCalledWith("auth");
  });

  it("switches snapshot mode and reflects the active one via aria-pressed", () => {
    const { onMode } = setup();
    expect(screen.getByTestId("mode-current")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("mode-previous")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByTestId("mode-previous"));
    expect(onMode).toHaveBeenCalledWith("previous");
  });

  it("summarizes change and warning counts", () => {
    setup();
    const summary = screen.getByTestId("summary");
    expect(summary).toHaveTextContent("3 changes");
    expect(summary).toHaveTextContent("1");
  });
  it("focuses the search input when '/' is pressed outside a field", () => {
    setup();
    const input = screen.getByTestId("search-input");
    expect(input).not.toHaveFocus();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(input).toHaveFocus();
  });

  it("clears the query on Escape while typing", () => {
    const { onSearch } = setup({ search: "auth" });
    fireEvent.keyDown(screen.getByTestId("search-input"), { key: "Escape" });
    expect(onSearch).toHaveBeenCalledWith("");
  });
});
