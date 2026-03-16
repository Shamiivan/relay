import { z } from "zod";
import { docsReadTool } from "../../tools/gworkspace/docs/docs.read/tool";
import { docsWriteTool } from "../../tools/gworkspace/docs/docs.write/tool";
import { driveCopyTool } from "../../tools/gworkspace/drive/drive.copy/tool";
import { driveSearchTool } from "../../tools/gworkspace/drive/drive.search/tool";
import { defineWorkflow, promptFile, type WorkflowToolExecutor } from "../sdk";

type DriveOwner = {
  displayName: string;
  emailAddress: string;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  parents: string[];
  modifiedTime: string;
  driveId: string;
  owners: DriveOwner[];
};

type DriveSearchResult = {
  files?: DriveFile[];
  error?: {
    type?: string;
    message?: string;
    field?: string;
    reason?: string;
  };
};

type DocsReadResult = {
  documentId?: string;
  title?: string;
  text?: string;
  error?: {
    type?: string;
    message?: string;
    field?: string;
    reason?: string;
  };
};

const BOARD_KEYWORDS = [
  "board",
  "agenda",
  "minutes",
  "meeting",
  "weekly",
  "update",
  "deck",
] as const;

const workflowStateSchema = z.object({
  boardFolderId: z.string().default(""),
  boardFolderName: z.string().default(""),
  boardFolderWebViewLink: z.string().default(""),
  candidates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    mimeType: z.string(),
    webViewLink: z.string(),
    parents: z.array(z.string()),
    modifiedTime: z.string(),
    driveId: z.string(),
    owners: z.array(z.object({
      displayName: z.string(),
      emailAddress: z.string(),
    })),
  })).default([]),
  selectedReferenceDocId: z.string().optional(),
  newDocId: z.string().optional(),
  newDocName: z.string().optional(),
  newDocWebViewLink: z.string().optional(),
});

function normalizeText(value: string): string {
  return value.toLowerCase();
}

function looksLikeBoardPrepMessage(message: string): boolean {
  const text = normalizeText(message);
  return text.includes("board") && (
    text.includes("meeting")
    || text.includes("agenda")
    || text.includes("last week")
    || text.includes("copy")
    || text.includes("format")
    || text.includes("structure")
    || text.includes("drive")
  );
}

function looksLikeReferenceSelectionMessage(message: string): boolean {
  const text = normalizeText(message);
  return text.includes("latest")
    || text.includes("ltest")
    || text.includes("mar ")
    || text.includes("best reference")
    || text.includes("best referece")
    || text.includes("use ")
    || text.includes("that one")
    || text.includes("this one");
}

function looksLikeBoardUpdateMessage(message: string): boolean {
  const text = normalizeText(message);
  return text.includes("task list")
    || text.includes("last week")
    || text.includes("update")
    || text.includes("revisited")
    || text.includes("goal")
    || text.includes("deliverable");
}

function escapeDriveQuery(value: string): string {
  return value.replace(/'/g, "\\'");
}

function scoreBoardFile(file: DriveFile): number {
  const text = normalizeText(file.name);
  return BOARD_KEYWORDS.reduce((score, keyword) => (
    text.includes(keyword) ? score + 1 : score
  ), 0);
}

function getModifiedTimestamp(file: DriveFile): number {
  const timestamp = Date.parse(file.modifiedTime);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isBoardFolder(file: DriveFile): boolean {
  return file.mimeType === "application/vnd.google-apps.folder"
    && normalizeText(file.name) === "board";
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatMonthLongDayYear(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  }).format(date);
}

function formatMonthShortDayYear(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  }).format(date);
}

function parseDateFromTitle(title: string): Date | null {
  const longWeekMatch = title.match(/Week of ([A-Za-z]+ \d{1,2}, \d{4})/i);
  if (longWeekMatch) {
    const parsed = new Date(longWeekMatch[1]);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const shortMatch = title.match(/\b([A-Za-z]{3,9} \d{1,2}, \d{4})\b/);
  if (shortMatch) {
    const parsed = new Date(shortMatch[1]);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function buildNextDocumentName(referenceName: string): string {
  const referenceDate = parseDateFromTitle(referenceName);
  const nextDate = referenceDate ? addDays(referenceDate, 7) : addDays(new Date(), 1);

  if (/Week of [A-Za-z]+ \d{1,2}, \d{4}/i.test(referenceName)) {
    return referenceName.replace(
      /Week of [A-Za-z]+ \d{1,2}, \d{4}/i,
      `Week of ${formatMonthLongDayYear(nextDate)}`,
    );
  }

  if (/\| Board Meeting/i.test(referenceName)) {
    return referenceName.replace(
      /\b[A-Za-z]{3,9} \d{1,2}, \d{4}\b/,
      formatMonthShortDayYear(nextDate),
    );
  }

  if (/\b[A-Za-z]{3,9} \d{1,2}, \d{4}\b/.test(referenceName)) {
    return referenceName.replace(
      /\b[A-Za-z]{3,9} \d{1,2}, \d{4}\b/,
      formatMonthShortDayYear(nextDate),
    );
  }

  return `${referenceName} Copy`;
}

async function searchDrive(
  executeTool: WorkflowToolExecutor["executeTool"],
  query: string,
  maxResults = 10,
): Promise<DriveSearchResult> {
  return await executeTool(driveSearchTool, {
    query,
    maxResults,
  });
}

async function readDocument(
  executeTool: WorkflowToolExecutor["executeTool"],
  documentId: string,
): Promise<DocsReadResult> {
  return await executeTool(docsReadTool, { documentId });
}

function selectReferenceCandidate(
  candidates: DriveFile[],
  message: string,
): DriveFile | null {
  if (candidates.length === 0) {
    return null;
  }

  const text = normalizeText(message);
  const latestCandidate = [...candidates].sort(
    (left, right) => getModifiedTimestamp(right) - getModifiedTimestamp(left),
  )[0] ?? null;

  if (text.includes("latest") || text.includes("ltest")) {
    return latestCandidate;
  }

  for (const candidate of candidates) {
    if (text.includes(normalizeText(candidate.name))) {
      return candidate;
    }
  }

  const monthDateMatch = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/);
  if (monthDateMatch) {
    const fragment = monthDateMatch[0];
    const matchedCandidate = candidates.find((candidate) =>
      normalizeText(candidate.name).includes(fragment),
    );
    if (matchedCandidate) {
      return matchedCandidate;
    }
  }

  return latestCandidate;
}

function getDriveErrorMessage(result: DriveSearchResult): string | null {
  if (!result.error) {
    return null;
  }

  return result.error.message
    || result.error.reason
    || `Drive search failed (${result.error.type ?? "unknown_error"})`;
}

export const boardMeetingPrepWorkflow = defineWorkflow({
  name: "board_meeting_prep",
  description: "Find the latest board document, copy it forward, and revise it across follow-up turns.",
  specialist: "communication",
  prompt: promptFile("./prompt.md"),
  tools: ["drive.search", "drive.copy", "docs.read", "docs.write"],
  state: workflowStateSchema,
  initialState: {
    boardFolderId: "",
    boardFolderName: "",
    boardFolderWebViewLink: "",
    candidates: [],
  },
  initialStep: "find_reference",
  trigger: {
    matches(ctx) {
      return ctx.specialist.id === "communication" && (
        looksLikeBoardPrepMessage(ctx.run.message)
        || looksLikeReferenceSelectionMessage(ctx.run.message)
        || looksLikeBoardUpdateMessage(ctx.run.message)
      );
    },
  },
  steps: {
    async find_reference(ctx) {
      const folderResult = await searchDrive(
        ctx.tools.executeTool,
        "name = 'Board' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        5,
      );
      const folderError = getDriveErrorMessage(folderResult);
      if (folderError) {
        return {
          state: ctx.state,
          outputText: `I recognized this as board-meeting prep, but I could not access Drive: ${folderError}`,
          summaryText: "Board workflow could not access Drive.",
        };
      }

      const boardFolder = (folderResult.files ?? []).find(isBoardFolder);
      if (!boardFolder) {
        return {
          state: ctx.state,
          outputText: "I recognized this as board-meeting prep, but I could not find a Drive folder named \"Board\".",
          summaryText: "Board workflow could not find the Board folder.",
        };
      }

      const fileResult = await searchDrive(
        ctx.tools.executeTool,
        `'${escapeDriveQuery(boardFolder.id)}' in parents and trashed = false`,
        20,
      );
      const fileError = getDriveErrorMessage(fileResult);
      if (fileError) {
        return {
          state: ctx.state,
          outputText: `I found the Board folder, but I could not list its contents: ${fileError}`,
          summaryText: "Board workflow could not list Board folder contents.",
        };
      }

      const candidateFiles = [...(fileResult.files ?? [])]
        .filter((file) => file.mimeType !== "application/vnd.google-apps.folder")
        .sort((left, right) => {
          const modifiedDelta = getModifiedTimestamp(right) - getModifiedTimestamp(left);
          if (modifiedDelta !== 0) {
            return modifiedDelta;
          }

          return scoreBoardFile(right) - scoreBoardFile(left);
        });

      const topCandidates = candidateFiles.slice(0, 5);
      if (topCandidates.length === 0) {
        return {
          state: {
            ...ctx.state,
            boardFolderId: boardFolder.id,
            boardFolderName: boardFolder.name,
            boardFolderWebViewLink: boardFolder.webViewLink,
            candidates: [],
          },
          outputText: [
            `I found the Board folder (${boardFolder.webViewLink}), but it does not contain any files I can use yet.`,
            "",
            "To complete board-meeting prep end to end, I still need document-copy, calendar-linking, and sharing tools.",
          ].join("\n"),
          summaryText: "Board workflow found no candidate reference files.",
        };
      }

      return {
        state: {
          ...ctx.state,
          boardFolderId: boardFolder.id,
          boardFolderName: boardFolder.name,
          boardFolderWebViewLink: boardFolder.webViewLink,
          candidates: topCandidates,
        },
        nextStep: "select_reference",
        summaryText: `Board workflow found ${topCandidates.length} candidate reference files.`,
      };
    },
    async select_reference(ctx) {
      const selectedReference = selectReferenceCandidate(
        ctx.state.candidates,
        ctx.run.message,
      );
      if (!selectedReference) {
        return {
          state: ctx.state,
          outputText: "I’m still in board-meeting prep, but I don’t have a valid reference document to continue from yet.",
          nextStep: "select_reference",
          summaryText: "Board workflow is waiting for a valid reference selection.",
        };
      }

      return {
        state: {
          ...ctx.state,
          selectedReferenceDocId: selectedReference.id,
        },
        nextStep: "create_working_doc",
        summaryText: `Board workflow selected ${selectedReference.name} as the reference document.`,
      };
    },
    async create_working_doc(ctx) {
      const selectedReference = ctx.state.candidates.find((candidate) =>
        candidate.id === ctx.state.selectedReferenceDocId
      );
      if (!selectedReference) {
        return {
          state: ctx.state,
          nextStep: "select_reference",
          summaryText: "Board workflow lost the selected reference and is returning to selection.",
        };
      }

      const copiedName = buildNextDocumentName(selectedReference.name);
      const copiedFile = await ctx.tools.executeTool(driveCopyTool, {
        fileId: selectedReference.id,
        name: copiedName,
        parentId: ctx.state.boardFolderId || undefined,
      });
      if (copiedFile.error) {
        return {
          state: ctx.state,
          outputText: await ctx.explainError({
            action: `create the next board meeting document from ${selectedReference.name}`,
            toolName: "drive.copy",
            error: copiedFile.error,
          }),
          nextStep: "create_working_doc",
          summaryText: "Board workflow failed while copying the working document.",
        };
      }

      return {
        state: {
          ...ctx.state,
          newDocId: copiedFile.id,
          newDocName: copiedFile.name,
          newDocWebViewLink: copiedFile.webViewLink,
        },
        nextStep: "finalize",
        summaryText: `Board workflow created working document ${copiedFile.name}.`,
      };
    },
    async revise_doc(ctx) {
      if (!ctx.state.newDocId) {
        return {
          state: ctx.state,
          nextStep: "find_reference",
          summaryText: "Board workflow is missing the working document and is restarting.",
        };
      }

      if (!looksLikeBoardPrepMessage(ctx.run.message) && !looksLikeBoardUpdateMessage(ctx.run.message)) {
        return {
          state: ctx.state,
          handoffToOpenLoop: true,
          summaryText: "Board workflow handed the message back to the open loop.",
        };
      }

      const referenceDocId = ctx.state.selectedReferenceDocId ?? ctx.state.newDocId;
      const referenceDoc = await readDocument(ctx.tools.executeTool, referenceDocId);
      if (referenceDoc.error) {
        return {
          state: ctx.state,
          outputText: await ctx.explainError({
            action: "read the board meeting reference document",
            toolName: "docs.read",
            error: referenceDoc.error,
          }),
          nextStep: "revise_doc",
          summaryText: "Board workflow failed while reading the reference document.",
        };
      }

      const workingDoc = await readDocument(ctx.tools.executeTool, ctx.state.newDocId);
      if (workingDoc.error) {
        return {
          state: ctx.state,
          outputText: await ctx.explainError({
            action: "read the current board meeting document",
            toolName: "docs.read",
            error: workingDoc.error,
          }),
          nextStep: "revise_doc",
          summaryText: "Board workflow failed while reading the working document.",
        };
      }

      const generatedText = await ctx.generateText({
        systemInstruction: [
          "You are updating a board meeting document for this week.",
          "Preserve the overall spirit of the existing document, but update the content based on the user's request.",
          "Return only the revised document text.",
          "Do not wrap the answer in markdown fences.",
        ].join(" "),
        prompt: [
          `User request:\n${ctx.run.message}`,
          "",
          `Existing working document title: ${workingDoc.title ?? ctx.state.newDocName ?? ""}`,
          "Existing working document text:",
          workingDoc.text ?? "",
          "",
          `Reference document title: ${referenceDoc.title ?? ""}`,
          "Reference document text:",
          referenceDoc.text ?? "",
        ].join("\n"),
      });

      const writeResult = await ctx.tools.executeTool(docsWriteTool, {
        documentId: ctx.state.newDocId,
        text: generatedText,
      });
      if (writeResult.error) {
        return {
          state: ctx.state,
          outputText: await ctx.explainError({
            action: "write the updated board meeting document",
            toolName: "docs.write",
            error: writeResult.error,
          }),
          nextStep: "revise_doc",
          summaryText: "Board workflow failed while writing the revised document.",
        };
      }

      return {
        state: ctx.state,
        outputText: `Updated ${ctx.state.newDocName ?? "the board meeting doc"}: ${ctx.state.newDocWebViewLink ?? ""}`.trim(),
        nextStep: "revise_doc",
        summaryText: "Board workflow revised the working document.",
      };
    },
    async finalize(ctx) {
      if (!ctx.state.newDocId || !ctx.state.newDocName || !ctx.state.newDocWebViewLink) {
        return {
          state: ctx.state,
          nextStep: "create_working_doc",
          summaryText: "Board workflow is missing working document metadata and is retrying creation.",
        };
      }

      return {
        state: ctx.state,
        outputText: `Created ${ctx.state.newDocName}: ${ctx.state.newDocWebViewLink}`,
        nextStep: "revise_doc",
        summaryText: "Board workflow finalized creation and is waiting for revisions.",
      };
    },
  },
});
