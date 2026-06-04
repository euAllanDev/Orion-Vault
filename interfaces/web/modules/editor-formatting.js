export function createEditorFormattingController(params) {
  const {
    getEditorSelection,
    getCurrentEditorLine,
    getEditorSelectedLineRange,
    replaceEditorRange
  } = params;

  function transformSelectedLines(transformLine) {
    const selection = getEditorSelectedLineRange();
    const lines = selection.block.split('\n');
    const nextLines = lines.map((line, index) => transformLine(line, index, lines));
    const nextBlock = nextLines.join('\n');
    replaceEditorRange(selection.rangeStart, selection.rangeEnd, nextBlock, {
      selectionStart: selection.rangeStart,
      selectionEnd: selection.rangeStart + nextBlock.length
    });
  }

  function splitLineIndent(line) {
    const match = String(line ?? '').match(/^(\s*)(.*)$/);
    return {
      indent: match?.[1] ?? '',
      content: match?.[2] ?? ''
    };
  }

  function toggleHeadingOnSelectedLines(prefix) {
    transformSelectedLines((line) => {
      if (!line.trim()) return line;
      const { indent, content } = splitLineIndent(line);
      const withoutHeading = content.replace(/^#{1,6}\s+/, '');
      if (content.startsWith(prefix)) {
        return `${indent}${withoutHeading}`;
      }
      return `${indent}${prefix}${withoutHeading}`;
    });
  }

  function togglePrefixOnSelectedLines(prefix) {
    const selection = getEditorSelectedLineRange();
    const lines = selection.block.split('\n').filter((line) => line.trim());
    const allHavePrefix = lines.length > 0 && lines.every((line) => splitLineIndent(line).content.startsWith(prefix));
    transformSelectedLines((line) => {
      if (!line.trim()) return line;
      const { indent, content } = splitLineIndent(line);
      return allHavePrefix && content.startsWith(prefix) ? `${indent}${content.slice(prefix.length)}` : `${indent}${prefix}${content}`;
    });
  }

  function toggleChecklistOnSelectedLines() {
    const selection = getEditorSelectedLineRange();
    const lines = selection.block.split('\n').filter((line) => line.trim());
    const allChecklist = lines.length > 0 && lines.every((line) => /^[-*+]\s+\[( |x|X)\]\s+/.test(line));
    transformSelectedLines((line) => {
      if (!line.trim()) return line;
      if (allChecklist && /^[-*+]\s+\[( |x|X)\]\s+/.test(line)) {
        return line.replace(/^([-*+])\s+\[( |x|X)\]\s+/, '');
      }
      if (/^[-*+]\s+/.test(line)) {
        return line.replace(/^([-*+])\s+/, '- [ ] ');
      }
      return `- [ ] ${line}`;
    });
  }

  function toggleListOnSelectedLines() {
    const selection = getEditorSelectedLineRange();
    const lines = selection.block.split('\n').filter((line) => line.trim());
    const allListed = lines.length > 0 && lines.every((line) => /^[-*+]\s+/.test(line) && !/^[-*+]\s+\[( |x|X)\]\s+/.test(line));
    transformSelectedLines((line) => {
      if (!line.trim()) return line;
      if (allListed && /^[-*+]\s+/.test(line)) {
        return line.replace(/^[-*+]\s+/, '');
      }
      if (/^[-*+]\s+\[( |x|X)\]\s+/.test(line)) {
        return line.replace(/^[-*+]\s+\[( |x|X)\]\s+/, '- ');
      }
      return /^[-*+]\s+/.test(line) ? line : `- ${line}`;
    });
  }

  function toggleCodeFenceOnSelection() {
    const { value, start, end } = getEditorSelection();
    const selectedText = value.slice(start, end);
    const lineSelection = getEditorSelectedLineRange();
    const selectedBlock = lineSelection.block;
    if (selectedBlock.startsWith('```\n') && selectedBlock.endsWith('\n```')) {
      replaceEditorRange(lineSelection.rangeStart, lineSelection.rangeEnd, selectedBlock.slice(4, -4), {
        selectionStart: lineSelection.rangeStart,
        selectionEnd: lineSelection.rangeStart + selectedBlock.length - 8
      });
      return;
    }

    if (selectedText.includes('\n') || selectedText.length === 0) {
      const content = selectedBlock || selectedText || '';
      replaceEditorRange(lineSelection.rangeStart, lineSelection.rangeEnd, `\`\`\`\n${content}\n\`\`\``, {
        selectionStart: lineSelection.rangeStart + 4,
        selectionEnd: lineSelection.rangeStart + 4 + content.length
      });
      return;
    }

    replaceEditorRange(start, end, `\`\`${selectedText}\`\``, {
      selectionStart: start + 2,
      selectionEnd: start + 2 + selectedText.length
    });
  }

  function applyMarkdownWrap(prefix, suffix = prefix) {
    const { value, start, end } = getEditorSelection();
    const selectedText = value.slice(start, end);
    const content = selectedText || '';
    const nextText = `${prefix}${content}${suffix}`;
    const nextSelectionStart = start + prefix.length;
    const nextSelectionEnd = selectedText ? end + prefix.length : start + prefix.length;
    replaceEditorRange(start, end, nextText, { selectionStart: nextSelectionStart, selectionEnd: nextSelectionEnd });
  }

  function continueMarkdownList(event) {
    const line = getCurrentEditorLine();
    if (line.start !== line.end || line.start !== line.lineEnd) return false;

    const checklistMatch = line.lineText.match(/^(\s*)([-*+])\s+\[(?: |x|X)\]\s*(.*)$/);
    if (checklistMatch) {
      event.preventDefault();
      const indent = checklistMatch[1] ?? '';
      const marker = checklistMatch[2] ?? '-';
      const content = String(checklistMatch[3] ?? '').trim();
      if (!content) {
        replaceEditorRange(line.lineStart, line.lineEnd, '', { selectionStart: line.lineStart, selectionEnd: line.lineStart });
        return true;
      }
      const nextPrefix = `\n${indent}${marker} [ ] `;
      replaceEditorRange(line.start, line.end, nextPrefix);
      return true;
    }

    const unorderedMatch = line.lineText.match(/^(\s*)([-*+])\s+(.*)$/);
    if (unorderedMatch) {
      event.preventDefault();
      const indent = unorderedMatch[1] ?? '';
      const marker = unorderedMatch[2] ?? '-';
      const content = String(unorderedMatch[3] ?? '').trim();
      if (!content) {
        replaceEditorRange(line.lineStart, line.lineEnd, '', { selectionStart: line.lineStart, selectionEnd: line.lineStart });
        return true;
      }
      replaceEditorRange(line.start, line.end, `\n${indent}${marker} `);
      return true;
    }

    const orderedMatch = line.lineText.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      event.preventDefault();
      const indent = orderedMatch[1] ?? '';
      const order = Number(orderedMatch[2] ?? '1');
      const content = String(orderedMatch[3] ?? '').trim();
      if (!content) {
        replaceEditorRange(line.lineStart, line.lineEnd, '', { selectionStart: line.lineStart, selectionEnd: line.lineStart });
        return true;
      }
      replaceEditorRange(line.start, line.end, `\n${indent}${order + 1}. `);
      return true;
    }

    return false;
  }

  function indentSelectedListLines(direction) {
    const selection = getEditorSelectedLineRange();
    const lines = selection.block.split('\n');
    const singleLine = !selection.block.includes('\n');
    const hasNonListLine = lines.some((line) => line.trim() && !/^(\s*)([-*+]\s+(?:\[(?: |x|X)\]\s+)?|\d+\.\s+|>\s+)/.test(line));

    if (singleLine && hasNonListLine && selection.start === selection.end) {
      if (direction > 0) {
        replaceEditorRange(selection.start, selection.end, '  ', {
          selectionStart: selection.start + 2,
          selectionEnd: selection.start + 2
        });
        return;
      }

      const removalStart = Math.max(selection.start - 2, selection.rangeStart);
      const removable = selection.value.slice(removalStart, selection.start);
      if (removable === '  ') {
        replaceEditorRange(removalStart, selection.start, '', {
          selectionStart: removalStart,
          selectionEnd: removalStart
        });
      }
      return;
    }

    const nextLines = lines.map((line) => {
      if (!line.trim()) return line;
      if (direction > 0) return `  ${line}`;
      return line.startsWith('  ') ? line.slice(2) : line.replace(/^\s{1,2}/, '');
    });
    const nextBlock = nextLines.join('\n');
    replaceEditorRange(selection.rangeStart, selection.rangeEnd, nextBlock, {
      selectionStart: selection.rangeStart,
      selectionEnd: selection.rangeStart + nextBlock.length
    });
  }

  return {
    applyMarkdownWrap,
    continueMarkdownList,
    indentSelectedListLines,
    toggleChecklistOnSelectedLines,
    toggleCodeFenceOnSelection,
    toggleHeadingOnSelectedLines,
    toggleListOnSelectedLines,
    togglePrefixOnSelectedLines
  };
}
