import { EditorView } from "@codemirror/view";
import { replaceRange, setCursor, getCharacterAtPos } from "src/utils/editor_utils";
import { Context } from "src/utils/context";


const RIGHT_COMMANDS = [
	"\\right",
	"\\bigr", "\\Bigr", "\\biggr", "\\Biggr"
];
const CLOSING_SYMBOLS = [
	")",
	"]", "\\rbrack",
	"}",
	"\\}", "\\rbrace",
	"\\rangle",
	"\\rceil", "\\rfloor",
	"\\rvert", "\\rVert",
	"\\urcorner"
];
const DELIMITERS = [
	"(", ")",
	"[", "]", "\\lbrack", "\\rbrack",
	"\\{", "\\}", "\\lbrace", "\\rbrace",
	"<", ">", "\\langle", "\\rangle", "\\lt", "\\gt",
	"\\lfloor", "\\rfloor", "\\lceil", "\\rceil",
	"/", "\\\\", "\\backslash",
	"|", "\\vert", "\\lvert", "\\rvert",
	"\\|", "\\Vert", "\\lVert", "\\rVert",
	"\\uparrow", "\\downarrow", "\\Uparrow", "\\Downarrow",
	"\\ulcorner", "\\urcorner",
	"."
];


const findClosingSymbolLength = (text: string, startIndex: number): number => {
	const sortedSymbols = [...CLOSING_SYMBOLS].sort((a, b) => b.length - a.length);
	const matchedSymbol = sortedSymbols.find((symbol) => text.startsWith(symbol, startIndex));

	if (matchedSymbol) {
		return matchedSymbol.length;
	}

	return 0;
}


const findRightCommandWithDelimiterLength = (text: string, startIndex: number): number => {
	const sortedCommands = [...RIGHT_COMMANDS].sort((a, b) => b.length - a.length);
	const matchedCommand = sortedCommands.find((command) => text.startsWith(command, startIndex));

	if (!matchedCommand) {
		return 0;
	}

	const afterCommandIndex = startIndex + matchedCommand.length;

	let whitespaceCount = 0;
	while (afterCommandIndex + whitespaceCount < text.length && /\s/.test(text.charAt(afterCommandIndex + whitespaceCount))) {
		whitespaceCount++;
	}
	const delimiterStartIndex = afterCommandIndex + whitespaceCount;

	const sortedDelimiters = [...DELIMITERS].sort((a, b) => b.length - a.length);
	const matchedDelimiter = sortedDelimiters.find((delimiter) => text.startsWith(delimiter, delimiterStartIndex));

	if (matchedDelimiter) {
		return matchedCommand.length + whitespaceCount + matchedDelimiter.length;
	}

	// If no matching delimiter is found, return the length of command
	// This helps users to easily identify and correct missing delimiter
	return matchedCommand.length;
}


export const tabout = (view: EditorView, ctx: Context): boolean => {
	if (!ctx.mode.inMath()) return false;

	const result = ctx.getBounds();
	if (!result) return false;
	const end = result.end;

	const pos = view.state.selection.main.to;
	const d = view.state.doc;
	const text = d.toString();

	// Move to the next closing bracket
	for (let i = pos; i < end; i++) {
		const rightDelimiterLength = findRightCommandWithDelimiterLength(text, i);
		if (rightDelimiterLength > 0) {
			setCursor(view, i + rightDelimiterLength);

			return true;
		}

		const closingSymbolLength = findClosingSymbolLength(text, i);
		if (closingSymbolLength > 0) {
			setCursor(view, i + closingSymbolLength);

			return true;
		}
	}


	// If cursor at end of line/equation, move to next line/outside $$ symbols

	// Check whether we're at end of equation
	// Accounting for whitespace, using trim
	const textBtwnCursorAndEnd = d.sliceString(pos, end);
	const atEnd = textBtwnCursorAndEnd.trim().length === 0;

	if (!atEnd) return false;


	// Check whether we're in inline math or a block eqn
	if (ctx.mode.inlineMath || ctx.mode.codeMath) {
		setCursor(view, end + 1);
	}
	else {
		// First, locate the $$ symbol
		const dollarLine = d.lineAt(end + 2);

		// If there's no line after the equation, create one

		if (dollarLine.number === d.lines) {
			replaceRange(view, dollarLine.to, dollarLine.to, "\n");
		}

		// Finally, move outside the $$ symbol
		setCursor(view, dollarLine.to + 1);


		// Trim whitespace at beginning / end of equation
		const line = d.lineAt(pos);
		replaceRange(view, line.from, line.to, line.text.trim());

	}

	return true;
}


export const shouldTaboutByCloseBracket = (view: EditorView, keyPressed: string) => {
	const sel = view.state.selection.main;
	if (!sel.empty) return;
	const pos = sel.from;

	const c = getCharacterAtPos(view, pos);
	const brackets = [")", "]", "}"];

	if ((c === keyPressed) && brackets.contains(c)) {
		return true;
	}
	else {
		return false;
	}
}