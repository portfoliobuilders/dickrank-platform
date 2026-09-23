import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LeaderboardCard } from "@/components/leaderboard/LeaderboardCard";
import { RatingComponent } from "@/components/ratings/RatingComponent";

describe("leaderboard card", () => {
  it("shows the podium rank, member, score, trend, and profile link", () => {
    const html = renderToStaticMarkup(
      <LeaderboardCard
        rank={1}
        username="ace"
        avatarUrl={null}
        score={88.2}
        trend="up"
        profileHref="/profile/ace"
      />,
    );
    expect(html).toContain("1st");
    expect(html).toContain("ace");
    expect(html).toContain("88.2");
    expect(html).toContain("Rank up");
    expect(html).toContain("View Profile");
    expect(html).toContain("/profile/ace");
  });

  it("styles second and third differently from the rest", () => {
    const second = renderToStaticMarkup(
      <LeaderboardCard rank={2} username="bee" avatarUrl={null} score={70} trend="down" profileHref="/profile/bee" />,
    );
    const fourth = renderToStaticMarkup(
      <LeaderboardCard rank={4} username="cee" avatarUrl={null} score={40} trend="same" profileHref="/profile/cee" />,
    );
    expect(second).toContain("2nd");
    expect(second).toContain("Rank down");
    expect(fourth).toContain("4th");
    expect(fourth).toContain("Rank unchanged");
    expect(second).not.toEqual(fourth);
  });
});

describe("rating form", () => {
  it("includes the score categories, pros and cons, review, anonymous choice, and submit", () => {
    const html = renderToStaticMarkup(<RatingComponent contentId="content-1" />);
    expect(html).toContain("Overall");
    expect(html).toContain("Feel");
    expect(html).toContain("Performance");
    expect(html).toContain("Experience");
    expect(html).toContain("User experience");
    expect(html).toContain("Pros");
    expect(html).toContain("Cons");
    expect(html).toContain("Detailed review");
    expect(html).toContain("Post anonymously");
    expect(html).toContain("Submit rating");
    expect(html).toContain('step="0.5"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="10"');
  });
});
