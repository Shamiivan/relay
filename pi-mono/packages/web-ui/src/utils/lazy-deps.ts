import type { LMStudioClient } from "@lmstudio/sdk";
import type { parseAsync, renderAsync } from "docx-preview";
import type * as PdfJs from "pdfjs-dist";
import type { Ollama } from "ollama/browser";
import type * as XLSX from "xlsx";

let pdfJsPromise: Promise<typeof PdfJs> | undefined;
let docxPreviewPromise: Promise<typeof import("docx-preview")> | undefined;
let xlsxPromise: Promise<typeof XLSX> | undefined;
let jsZipPromise: Promise<any> | undefined;
let ollamaPromise: Promise<typeof import("ollama/browser")> | undefined;
let lmStudioPromise: Promise<typeof import("@lmstudio/sdk")> | undefined;

export type PdfJsModule = typeof PdfJs;
export type XlsxModule = typeof XLSX;
export type JsZipModule = typeof import("jszip");
export type DocxParseAsync = typeof parseAsync;
export type DocxRenderAsync = typeof renderAsync;
export type OllamaClass = typeof Ollama;
export type LMStudioClientClass = typeof LMStudioClient;

export function loadPdfJs(): Promise<PdfJsModule> {
	if (!pdfJsPromise) {
		pdfJsPromise = import("pdfjs-dist").then((module) => {
			module.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
			return module;
		});
	}
	return pdfJsPromise;
}

export async function loadDocxParseAsync(): Promise<DocxParseAsync> {
	const module = await (docxPreviewPromise ??= import("docx-preview"));
	return module.parseAsync;
}

export async function loadDocxRenderAsync(): Promise<DocxRenderAsync> {
	const module = await (docxPreviewPromise ??= import("docx-preview"));
	return module.renderAsync;
}

export async function loadXlsx(): Promise<XlsxModule> {
	return (xlsxPromise ??= import("xlsx")) as Promise<XlsxModule>;
}

export async function loadJsZip(): Promise<JsZipModule> {
	const module = await (jsZipPromise ??= import("jszip"));
	return module.default ?? module;
}

export async function loadOllamaClass(): Promise<OllamaClass> {
	const module = await (ollamaPromise ??= import("ollama/browser"));
	return module.Ollama;
}

export async function loadLMStudioClientClass(): Promise<LMStudioClientClass> {
	const module = await (lmStudioPromise ??= import("@lmstudio/sdk"));
	return module.LMStudioClient;
}
