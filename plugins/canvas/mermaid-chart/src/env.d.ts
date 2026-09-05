// 重依赖从 CDN 动态加载,不打进 bundle;此处声明以便 TS 提示
declare module "https://esm.sh/mermaid@11" {
    const mermaid: { initialize: (opts: Record<string, unknown>) => void; render: (id: string, code: string) => Promise<{ svg: string }> };
    export default mermaid;
}
