import { EditorView } from "@codemirror/view";
import { replaceRange, setCursor, getCharacterAtPos } from "src/utils/editor_utils";
import { Context } from "src/utils/context";
import { getLatexSuiteConfig } from "src/snippets/codemirror/config";


export const SORTED_LEFT_COMMANDS = [
	"\\left",
	"\\bigl", "\\Bigl", "\\biggl", "\\Biggl"
].sort((a, b) => b.length - a.length);
export const SORTED_RIGHT_COMMANDS = [
	"\\right",
	"\\bigr", "\\Bigr", "\\biggr", "\\Biggr"
].sort((a, b) => b.length - a.length);
export const SORTED_DELIMITERS = [
	"(", ")",
	"[", "]", "\\lbrack", "\\rbrack",
	"\\{", "\\}", "\\lbrace", "\\rbrace",
	"<", ">", "\\langle", "\\rangle", "\\lt", "\\gt",
	"|", "\\vert", "\\lvert", "\\rvert",
	"\\|", "\\Vert", "\\lVert", "\\rVert",
	"\\lfloor", "\\rfloor",
	"\\lceil", "\\rceil",
	"\\ulcorner", "\\urcorner",
	"/", "\\\\", "\\backslash",
	"\\uparrow", "\\downarrow",
	"\\Uparrow", "\\Downarrow",
	"."
].sort((a, b) => b.length - a.length);


export const isCommandEnd = (str: string): boolean => {
	return /\\[a-zA-Z]+\\*?$/.test(str);
}


const isMatchingCommand = (text: string, command: string, startIndex: number): boolean => {
	if (!text.startsWith(command, startIndex)) {
		return false;
	}

	const nextChar = text.charAt(startIndex + command.length);
	const isEndOfCommand = !/[a-zA-Z]/.test(nextChar);

	return isEndOfCommand;
}


const isMatchingToken = (text: string, token: string, startIndex: number): boolean => {
	if (isCommandEnd(token)) {
		return isMatchingCommand(text, token, startIndex);
	}
	else {
		return text.startsWith(token, startIndex);
	}
}


const findTokenLength = (sortedTokens: string[], text: string, startIndex: number): number => {
	const matchedToken = sortedTokens.find((token) => isMatchingToken(text, token, startIndex));

	if (matchedToken) {
		return matchedToken.length;
	}

	return 0;
}


const findCommandWithDelimiterLength = (sortedCommands: string[], text: string, startIndex: number): number => {
	const matchedCommand = sortedCommands.find((command) => isMatchingCommand(text, command, startIndex));

	if (!matchedCommand) {
		return 0;
	}

	const afterCommandIndex = startIndex + matchedCommand.length;

	let whitespaceCount = 0;
	while (/\s/.test(text.charAt(afterCommandIndex + whitespaceCount))) {
		whitespaceCount++;
	}
	const delimiterStartIndex = afterCommandIndex + whitespaceCount;

	const matchedDelimiter = SORTED_DELIMITERS.find((delimiter) => isMatchingToken(text, delimiter, delimiterStartIndex));

	if (!matchedDelimiter) {
		return 0;
	}

	return matchedCommand.length + whitespaceCount + matchedDelimiter.length;
}


export const tabout = (view: EditorView, ctx: Context): boolean => {
	if (!ctx.mode.inMath()) return false;

	const result = ctx.getBounds();
	if (!result) return false;
	const start = result.start;
	const end = result.end;

	const pos = view.state.selection.main.to;
	const d = view.state.doc;
	const text = d.toString();

	const sortedClosingSymbols = getLatexSuiteConfig(view).sortedtaboutClosingSymbols;

	// Move to the next closing bracket
	let i = start;
	while (i < end) {
		const leftDelimiterLength = findCommandWithDelimiterLength(SORTED_LEFT_COMMANDS, text, i);
		if (leftDelimiterLength > 0) {
			i += leftDelimiterLength;

			continue;
		}

		const rightDelimiterLength = findCommandWithDelimiterLength(SORTED_RIGHT_COMMANDS, text, i);
		if (rightDelimiterLength > 0) {
			i += rightDelimiterLength;

			if (i <= pos) continue;

			setCursor(view, i);

			return true;
		}

		// This helps users easily identify and correct missing delimiters.
		const rightCommandLength = findTokenLength(SORTED_RIGHT_COMMANDS, text, i);
		if (rightCommandLength > 0) {
			// If the right command + delimiter is successfully found, the program will not reach this line.
			i += rightCommandLength;

			if (i <= pos) continue;

			setCursor(view, i);

			return true;
		}

		const closingSymbolLength = findTokenLength(sortedClosingSymbols, text, i);
		if (closingSymbolLength > 0) {
			i += closingSymbolLength;

			if (i <= pos) continue;

			setCursor(view, i);

			return true;
		}

		i++;
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
