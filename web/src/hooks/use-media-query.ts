import { useEffect, useState } from "react";

/** 监听 CSS media query 匹配状态，用于 JS 侧的小屏自适应（CSS 断点之外的画布/3D 场景逻辑）。 */
export function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(query).matches));

    useEffect(() => {
        const list = window.matchMedia(query);
        const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
        setMatches(list.matches);
        list.addEventListener("change", onChange);
        return () => list.removeEventListener("change", onChange);
    }, [query]);

    return matches;
}
