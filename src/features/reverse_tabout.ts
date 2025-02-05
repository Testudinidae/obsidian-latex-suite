import { EditorView } from "@codemirror/view";
import { setCursor } from "src/utils/editor_utils";
import { Context } from "src/utils/context";
import { getLatexSuiteConfig } from "src/snippets/codemirror/config";
import { SORTED_LEFT_COMMANDS, SORTED_RIGHT_COMMANDS, SORTED_DELIMITERS, isCommandEnd } from "src/features/tabout"


const isMatchingCommand = (text: string, command: string, endIndex: number): boolean => {
	return text.endsWith(command, endIndex)
}


const isMatchingToken = (text: string, token: string, endIndex: number): boolean => {
	if (isCommandEnd(token)) {
		return isMatchingCommand(text, token, endIndex);
	}
	else {
		return text.endsWith(token, endIndex);
	}
}


const findTokenLength = (sortedTokens: string[], text: string, endIndex: number): number => {
	const matchedToken = sortedTokens.find((token) => isMatchingToken(text, token, endIndex));

	if (matchedToken) {
		return matchedToken.length;
	}

	return 0;
}


const findCommandWithDelimiterLength = (sortedCommands: string[], text: string, endIndex: number): number => {
	const matchedDelimiter = SORTED_DELIMITERS.find((delimiter) => isMatchingToken(text, delimiter, endIndex));

	if (!matchedDelimiter) {
		return 0;
	}

	const beforeDelimiterIndex = endIndex - matchedDelimiter.length;

	let whitespaceCount = 0;
	while (/\s/.test(text.charAt(beforeDelimiterIndex - whitespaceCount - 1))) {
		whitespaceCount++;
	}
	const commandEndIndex = beforeDelimiterIndex - whitespaceCount;

	const matchedCommand = sortedCommands.find((command) => isMatchingCommand(text, command, commandEndIndex));

	if (!matchedCommand) {
		return 0;
	}

	return matchedCommand.length + whitespaceCount + matchedDelimiter.length;
}


export const reverseTabout = (view: EditorView, ctx: Context): boolean => {
	if (!ctx.mode.inMath()) return false;

	const result = ctx.getBounds();
	if (!result) return false;
	const start = result.start;
	const end = result.end;

	const pos = view.state.selection.main.to;
	const text = view.state.doc.toString();

	const sortedOpeningSymbols = getLatexSuiteConfig(view).sortedtaboutOpeningSymbols;

	// Move to the previous opening bracket
	let i = end;
	while (i > start) {
		const rightDelimiterLength = findCommandWithDelimiterLength(SORTED_RIGHT_COMMANDS, text, i);
		if (rightDelimiterLength > 0) {
			i -= rightDelimiterLength;

			continue;
		}

		const leftDelimiterLength = findCommandWithDelimiterLength(SORTED_LEFT_COMMANDS, text, i);
		if (leftDelimiterLength > 0) {
			i -= leftDelimiterLength;

			if (i >= pos) continue;

			setCursor(view, i);

			return true;
		}

		// This helps users easily identify and correct missing delimiters.
		const leftCommandLength = findTokenLength(SORTED_LEFT_COMMANDS, text, i);
		if (leftCommandLength > 0) {
			// If the left command + delimiter is successfully found, the program will not reach this line.

			// Set cursor after left command first
			if (i < pos) {
				setCursor(view, i);

				return true;
			}
			i -= leftCommandLength;

			if (i >= pos) continue;

			// if user use reverse tabout again, set cursor before left command 
			setCursor(view, i);

			return true;
		}

		const openingSymbolLength = findTokenLength(sortedOpeningSymbols, text, i);
		if (openingSymbolLength > 0) {
			i -= openingSymbolLength;

			if (i >= pos) continue;

			setCursor(view, i);

			return true;
		}

		i--;
	}

	return false;
}
