import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { expect, test, vi, afterEach } from "vitest";
import { BufferedNumber } from "./buffered-number";
afterEach(cleanup);
test("empty numeric draft stays visible and blocks save without committing zero", () => {
  const change = vi.fn();
  render(<BufferedNumber value={8} min={1} max={64} onChange={change} />);
  const input = screen.getByRole("spinbutton") as HTMLInputElement;
  fireEvent.change(input,{target:{value:""}});
  expect(input.value).toBe("");
  expect(input.checkValidity()).toBe(false);
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(input,{target:{value:"12"}});
  expect(change).toHaveBeenCalledWith(12);
  expect(input.checkValidity()).toBe(true);
});
