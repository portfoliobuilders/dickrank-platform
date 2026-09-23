import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateModeration } from "./moderation";

describe("evaluateModeration", () => {
  it("approves adult nudity when no safety labels fire", () => {
    const decision = evaluateModeration({
      labels: [{ name: "Explicit Nudity", confidence: 99 }],
      faces: [{ ageLow: 25, ageHigh: 35, confidence: 99 }],
      providerAvailable: true,
    });
    assert.equal(decision.outcome, "APPROVED");
    assert.equal(decision.scores[0]?.confidence, 99);
  });

  it("approves when other labels stay at or under 50%", () => {
    const decision = evaluateModeration({
      labels: [{ name: "Violence", confidence: 50 }],
      faces: [],
      providerAvailable: true,
    });
    assert.equal(decision.outcome, "APPROVED");
  });

  it("flags other labels above 50%", () => {
    const decision = evaluateModeration({
      labels: [{ name: "Violence", confidence: 51 }],
      faces: [],
      providerAvailable: true,
    });
    assert.equal(decision.outcome, "FLAGGED");
  });

  it("rejects a minor label at 50% or more", () => {
    const decision = evaluateModeration({
      labels: [{ name: "Child Exploitation", parentName: "Visually Disturbing", confidence: 50 }],
      faces: [],
      providerAvailable: true,
    });
    assert.equal(decision.outcome, "REJECTED");
  });

  it("does not auto-approve a weak minor signal", () => {
    const decision = evaluateModeration({
      labels: [{ name: "Underage", confidence: 20 }],
      faces: [],
      providerAvailable: true,
    });
    assert.equal(decision.outcome, "MANUAL_REVIEW");
  });

  it("rejects a face whose oldest estimate is under 18", () => {
    const decision = evaluateModeration({
      labels: [],
      faces: [{ ageLow: 10, ageHigh: 16, confidence: 90 }],
      providerAvailable: true,
    });
    assert.equal(decision.outcome, "REJECTED");
  });

  it("sends an age range that crosses 18 to review", () => {
    const decision = evaluateModeration({
      labels: [],
      faces: [{ ageLow: 16, ageHigh: 24, confidence: 80 }],
      providerAvailable: true,
    });
    assert.equal(decision.outcome, "MANUAL_REVIEW");
  });

  it("rejects non-consensual labels at 50% or more", () => {
    const decision = evaluateModeration({
      labels: [{ name: "Non-Consensual", confidence: 70 }],
      faces: [],
      providerAvailable: true,
    });
    assert.equal(decision.outcome, "REJECTED");
  });

  it("holds the upload when the provider is down", () => {
    const decision = evaluateModeration({
      labels: [],
      faces: [],
      providerAvailable: false,
    });
    assert.equal(decision.outcome, "MANUAL_REVIEW");
  });
});
