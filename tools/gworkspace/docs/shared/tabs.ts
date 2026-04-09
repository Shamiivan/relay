import type { docs_v1 } from "googleapis";

type DocsDocument = docs_v1.Schema$Document;
type DocsTab = docs_v1.Schema$Tab;
type DocsDocumentTab = docs_v1.Schema$DocumentTab;

export type ResolvedDocTab = {
  tabId?: string;
  title?: string;
  body?: DocsDocumentTab["body"];
};

export type DocTabSummary = {
  tabId: string;
  title: string;
  parentTabId?: string;
  index: number;
};

export function flattenTabs(document: DocsDocument): DocsTab[] {
  const allTabs: DocsTab[] = [];

  function visit(tab: DocsTab) {
    allTabs.push(tab);
    for (const child of tab.childTabs ?? []) {
      visit(child);
    }
  }

  for (const tab of document.tabs ?? []) {
    visit(tab);
  }

  return allTabs;
}

export function listTabSummaries(document: DocsDocument): DocTabSummary[] {
  const summaries: DocTabSummary[] = [];

  function visit(tab: DocsTab, parentTabId?: string) {
    const tabId = tab.tabProperties?.tabId;
    if (tabId) {
      summaries.push({
        tabId,
        title: tab.tabProperties?.title ?? tabId,
        ...(parentTabId ? { parentTabId } : {}),
        index: summaries.length,
      });
    }
    for (const child of tab.childTabs ?? []) {
      visit(child, tabId ?? undefined);
    }
  }

  for (const tab of document.tabs ?? []) {
    visit(tab);
  }

  return summaries;
}

export function resolveRequestedTab(document: DocsDocument, tabId?: string): ResolvedDocTab {
  if (!tabId) {
    const firstTab = flattenTabs(document)[0];
    return {
      tabId: firstTab?.tabProperties?.tabId ?? undefined,
      title: firstTab?.tabProperties?.title ?? undefined,
      body: document.body ?? firstTab?.documentTab?.body,
    };
  }

  const matchingTab = flattenTabs(document).find((tab) => tab.tabProperties?.tabId === tabId);
  if (!matchingTab) {
    throw new Error(`Tab not found: ${tabId}`);
  }

  return {
    tabId,
    title: matchingTab.tabProperties?.title ?? undefined,
    body: matchingTab.documentTab?.body,
  };
}
