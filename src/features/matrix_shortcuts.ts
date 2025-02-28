import { EditorView } from "@codemirror/view";
import { EditorSelection, SelectionRange } from "@codemirror/state";
import { Context, Bounds } from "src/utils/context";
import { setCursor } from "src/utils/editor_utils";
import { getLatexSuiteConfig } from "src/snippets/codemirror/config";
import { tabout } from "src/features/tabout";


const ALIGNMENT = " & ";
const LINE_BREAK = " \\\\\n"
const LINE_BREAK_INLINE = " \\\\ "


const generateSeparatorChange = (separator: string, view: EditorView, range: SelectionRange): { from: number, to: number, insert: string } => {
	const d = view.state.doc;

	// Insert indents
	const fromLineText = d.lineAt(range.from).text;
	const leadingIndents = fromLineText.match(/^\s*/)[0];
	separator = separator.replaceAll("\n", `\n${leadingIndents}`);

	return { from: range.from, to: range.to, insert: separator };
}


const applySeparator = (separator: string, view: EditorView) => {
	const sel = view.state.selection;
	const changes = sel.ranges.map(range => generateSeparatorChange(separator, view, range));

	const tempTransaction = view.state.update({ changes });

	const newSelection = EditorSelection.create(
		changes.map(({ from, to, insert }) =>
			EditorSelection.cursor(tempTransaction.changes.mapPos(from) + insert.length)
		),
		sel.mainIndex
	);

	view.dispatch(view.state.update({ changes, selection: newSelection }));
}


const findNextEnd = (pattern: RegExp, view: EditorView, pos: number, envBound: Bounds) => {
	let d = view.state.doc;

	let line = d.lineAt(pos);
	while (line.from < envBound.end) {
		const trimmedLine = line.text.trimStart();
		const indentLength = line.length - trimmedLine.length;
		const effectiveLineStart = line.from + indentLength;

		const matches = [...trimmedLine.matchAll(pattern)];
		const match = matches.find(match => (effectiveLineStart + match.index > pos) && (effectiveLineStart + match.index < envBound.end));
		if (match) {
			return effectiveLineStart + match.index;
		}

		if (line.number + 1 >= d.lines) break;

		line = d.line(line.number + 1);
	}

	const envContent = d.sliceString(envBound.start, envBound.end);
	const trimmedEnvContent = envContent.trimEnd();
	const endsWithBreak = trimmedEnvContent.endsWith("\\\\");
	if (endsWithBreak) {
		return -1;
	}

	line = d.lineAt(envBound.start + trimmedEnvContent.length);
	const lastPos = Math.min(line.to, envBound.end);

	if (pos < lastPos) {
		return lastPos;
	}

	return -1;
}
const findNextRowEnd = findNextEnd.bind(null, /[\t ]?\\\\/g)
const findNextCellEnd = findNextEnd.bind(null, /[\t ]?(?:&|\\\\)/g)


export const runMatrixShortcuts = (view: EditorView, ctx: Context, key: string, shiftKey: boolean): boolean => {
	const settings = getLatexSuiteConfig(view);

	// Check whether we are inside a matrix / align / case environment
	let isInsideAnEnv = false;
	let env;

	for (const envName of settings.matrixShortcutsEnvNames) {
		env = { openSymbol: "\\begin{" + envName + "}", closeSymbol: "\\end{" + envName + "}" };

		isInsideAnEnv = ctx.isWithinEnvironment(ctx.pos, env);
		if (isInsideAnEnv) break;
	}

	if (!isInsideAnEnv) return false;

	if (key === "Tab" && view.state.selection.main.empty) {
		if (shiftKey) {
			// Move cursor to end of cell
			const envBound = ctx.getEnvironmentBound(ctx.pos, env);
			const pos = findNextCellEnd(view, ctx.pos, envBound);

			if (pos >= 0) {
				setCursor(view, pos);
			}
			else {
				tabout(view, ctx);
			}
		}
		else {
			applySeparator(ALIGNMENT, view);
		}

		return true;
	}

	else if (key === "Enter") {
		if (shiftKey) {
			// Move cursor to end of next row
			const envBound = ctx.getEnvironmentBound(ctx.pos, env);
			const pos = findNextRowEnd(view, ctx.pos, envBound);

			if (pos >= 0) {
				setCursor(view, pos);
			}
			else {
				tabout(view, ctx);
			}
		}
		else {
			if (ctx.mode.inlineMath) {
				applySeparator(LINE_BREAK_INLINE, view);
			}
			else {
				applySeparator(LINE_BREAK, view);
			}
		}

		return true;
	}

	return false;
}
