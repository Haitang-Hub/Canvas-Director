export type ReleaseInfo = {
    version: string;
    date: string;
    items: { type: string; content: string }[];
};

export function parseChangelog(content: string): ReleaseInfo[] {
    const seen = new Set<string>();
    return content
        .split(/^## /m)
        .slice(1)
        .map((block) => {
            const [title = "", ...lines] = block.trim().split("\n");
            const [, version = title.trim(), date = ""] = title.match(/^(.+?)(?:\s+-\s+(.+))?$/) || [];
            return {
                version: version.trim(),
                date: date.trim(),
                items: lines
                    .map((line) => line.trim().match(/^\+\s+\[(.+?)\]\s+(.+)$/))
                    .filter((match): match is RegExpMatchArray => Boolean(match))
                    .map((match) => ({ type: match[1], content: match[2] })),
            };
        })
        .filter((release) => release.items.length)
        .filter((release) => {
            if (seen.has(release.version)) return false;
            seen.add(release.version);
            return true;
        });
}
