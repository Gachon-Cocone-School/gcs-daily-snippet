import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Define the Snippet schema using Zod
const snippetSchema = z.object({
  snippetId: z.string(),
  userId: z.string(),
  date: z.string(),
  snippet: z.string(),
  created_at: z.date(),
  modified_at: z.date(),
});

export type Snippet = z.infer<typeof snippetSchema>;

// For now, we'll create a simple mock database
// This is a temporary solution until we properly set up Firebase Admin SDK
const snippets: Record<string, Snippet> = {};

export const snippetRouter = createTRPCRouter({
  // Get a snippet by date for the current user
  getByDate: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const userId = ctx.session?.user?.id ?? "debug-user-id";
        const snippetId = `${userId}_${input.date}`;

        console.log(`Fetching snippet with ID: ${snippetId}`);

        // Return from our in-memory mock database
        return snippets[snippetId] ?? null;
      } catch (error) {
        console.error("Error fetching snippet:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to retrieve snippet: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }),

  // Get all snippets for the current user
  getAllByUser: publicProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.session?.user?.id ?? "debug-user-id";

      console.log(`Fetching all snippets for user: ${userId}`);

      // Create a test snippet if it doesn't exist
      const testSnippetId = `${userId}_2025-05-01`;
      if (!snippets[testSnippetId]) {
        const now = new Date();
        snippets[testSnippetId] = {
          snippetId: testSnippetId,
          userId,
          date: "2025-05-01",
          snippet: "Test snippet for debugging purposes",
          created_at: now,
          modified_at: now,
        };
      }

      // Return all snippets that belong to this user
      return Object.values(snippets).filter(
        (snippet) => snippet.userId === userId,
      );
    } catch (error) {
      console.error("Error fetching all snippets:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to retrieve snippets: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }),

  // Create or update a snippet
  upsert: publicProcedure
    .input(
      z.object({
        date: z.string(),
        snippet: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.session?.user?.id ?? "debug-user-id";
        const snippetId = `${userId}_${input.date}`;
        const now = new Date();

        console.log(`Upserting snippet with ID: ${snippetId}`);

        // Check if the snippet already exists
        if (snippets[snippetId]) {
          // Update existing snippet
          const existingSnippet = snippets[snippetId];
          snippets[snippetId] = {
            ...existingSnippet,
            snippet: input.snippet,
            modified_at: now,
          };
        } else {
          // Create new snippet
          snippets[snippetId] = {
            snippetId,
            userId,
            date: input.date,
            snippet: input.snippet,
            created_at: now,
            modified_at: now,
          };
        }

        return snippets[snippetId];
      } catch (error) {
        console.error("Error saving snippet:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to save snippet: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }),
});
