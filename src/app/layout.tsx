"use client";

import "~/styles/globals.css";

import { useEffect } from "react";
import { Geist } from "next/font/google";
import { useAuth } from "~/lib/auth-context";
import { TRPCReactProvider } from "~/trpc/react";
import { AuthProvider } from "~/lib/auth-context";
import { TeamProvider } from "~/lib/team-context";
import Strings from "~/constants/strings";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <head>
        <title>{Strings.appName}</title>
        <meta name="description" content="Daily planning application" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <TRPCReactProvider>
          <AuthProvider>
            <TeamProvider>
              <ClientWrapper>{children}</ClientWrapper>
            </TeamProvider>
          </AuthProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}

// Client component to update the title
function ClientWrapper({ children }: { children: React.ReactNode }) {
  const { teamAlias } = useAuth();

  useEffect(() => {
    // Only update if teamAlias is available
    if (!teamAlias) return;

    // Get the last teamAlias if available
    const lastTeamAlias =
      teamAlias.length > 0 ? teamAlias[teamAlias.length - 1] : null;

    // Update document title with the last teamAlias if available
    if (lastTeamAlias) {
      // Check if title already has the correct format to prevent unnecessary updates
      const expectedTitle = Strings.titleFormat
        .replace("{appName}", Strings.appName)
        .replace("{teamAlias}", lastTeamAlias);

      if (document.title !== expectedTitle) {
        document.title = expectedTitle;
      }
    } else if (document.title !== Strings.appName) {
      document.title = Strings.appName;
    }
  }, [teamAlias]);

  return <>{children}</>;
}
