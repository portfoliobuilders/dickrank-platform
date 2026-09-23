import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rankings · DickRank",
  description: "Top creators by reviews, activity, and verification. 18+ only.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
