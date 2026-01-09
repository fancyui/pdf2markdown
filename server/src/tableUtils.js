/**
 * Merges markdown tables that span across multiple pages.
 * 
 * @param {string[]} pages - Array of markdown strings, one for each page.
 * @returns {string[]} - Array of processed markdown strings.
 */
function mergeTablesAcrossPages(pages) {
    if (!pages || pages.length === 0) return pages;

    const processedPages = [...pages];

    for (let i = 0; i < processedPages.length - 1; i++) {
        const currentPage = processedPages[i];
        const nextPage = processedPages[i + 1];

        const tableAtEnd = findTableAtEnd(currentPage);
        const tableAtStart = findTableAtStart(nextPage);

        if (tableAtEnd && tableAtStart) {
            if (isTableCompatible(tableAtEnd.content, tableAtStart.content)) {
                // Merge tables
                const mergedTable = mergeTables(tableAtEnd.content, tableAtStart.content);

                // Update current page: replace the table at the end with the merged table
                // AND append the rest of the next page (excluding the table at start)

                const nextPageRest = nextPage.substring(tableAtStart.endIndex).trim();

                // Construct new current page
                // Part 1: currentPage before table
                // Part 2: mergedTable
                // Part 3: rest of nextPage (if any) - effectively merging page content

                const newCurrentPage = currentPage.substring(0, tableAtEnd.startIndex) +
                    mergedTable +
                    (nextPageRest ? '\n\n' + nextPageRest : '');

                processedPages[i] = newCurrentPage;

                // Remove the next page as it has been merged into the current one
                processedPages.splice(i + 1, 1);

                // Decrement i to re-evaluate the current page (which now has new content) 
                // against the *new* next page (which was previously i+2).
                i--;
            }
        }
    }

    return processedPages;
}

function findTableAtEnd(text) {
    // Look for a table at the end of the string.
    // Simple heuristic: check last non-empty lines match pipe patterns.
    const lines = text.trimEnd().split('\n');
    if (lines.length === 0) return null;

    let endIndex = text.trimEnd().length; // Approximate, assuming trimEnd didn't remove critical table parts (just whitespace)
    // Actually, better to work with the original text indices.

    // Let's find the last occurrence of a table-like block.
    // We scan backwards from the end.

    let i = lines.length - 1;
    let tableLines = [];

    // Consume empty lines at end
    while (i >= 0 && lines[i].trim() === '') {
        i--;
    }

    const endLineIndex = i;
    if (endLineIndex < 0) return null;

    // Check if last content line looks like a table row
    if (!isTableRow(lines[endLineIndex])) return null;

    // Collect table rows backwards
    while (i >= 0 && isTableRow(lines[i])) {
        tableLines.unshift(lines[i]);
        i--;
    }

    // Verify it has a header separator if it's a valid independent table (optional, but good for confidence)
    // But wait, if it's a split table, the bottom part might NOT have a header if it was split purely in the middle of rows?
    // User says "OCR produces tables". Usually OCR tools try to frame tables.
    // If it's a valid markdown table, it likely has headers or at least structure.

    // Let's assume we captured the block.
    const content = tableLines.join('\n');

    // Calculate indices in original text
    // This is tricky with split/join. Let's use `lastIndexOf` with the specific content.
    // Warning: content might appear multiple times.
    // But we know it's at the end.
    const startIndex = text.lastIndexOf(content);
    const actualEndIndex = startIndex + content.length;

    return {
        content,
        startIndex,
        endIndex: actualEndIndex
    };
}

function findTableAtStart(text) {
    const lines = text.trimStart().split('\n');
    if (lines.length === 0) return null;

    let i = 0;
    // Consume empty lines at start
    while (i < lines.length && lines[i].trim() === '') {
        i++;
    }

    const startLineIndex = i;
    if (startLineIndex >= lines.length) return null;

    if (!isTableRow(lines[startLineIndex])) return null;

    let tableLines = [];
    while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
    }

    const content = tableLines.join('\n');
    const startIndex = text.indexOf(content); // Should be near start
    const endIndex = startIndex + content.length;

    return {
        content,
        startIndex,
        endIndex
    };
}

function isTableRow(line) {
    return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isTableCompatible(table1, table2) {
    // Check column counts
    const countCols = (tableStr) => {
        const firstLine = tableStr.trim().split('\n')[0];
        return (firstLine.match(/\|/g) || []).length;
    };

    return countCols(table1) === countCols(table2);
}

function mergeTables(table1, table2) {
    const rows2 = table2.trim().split('\n');

    // Check if table2 has a header separator row (e.g. |---|---|)
    const separatorIndex = rows2.findIndex(row => row.match(/^\|[\s-]+\|/));

    let contentToAppend = rows2;

    if (separatorIndex !== -1) {
        // It has a header. Usually header is row 0 and separator is row 1.
        // If we are merging, we assume table2 is a continuation, so we drop the repeated header.
        // So we skip everything up to and including the separator.
        contentToAppend = rows2.slice(separatorIndex + 1);
    }

    return table1.trim() + '\n' + contentToAppend.join('\n');
}

module.exports = {
    mergeTablesAcrossPages
};
