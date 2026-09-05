// 重依赖从 CDN 动态加载,不打进 bundle;此处声明以便 TS 提示
declare module "https://esm.sh/qrcode@1.5.4" {
    const qrcode: { toDataURL: (text: string, opts?: Record<string, unknown>) => Promise<string> };
    export default qrcode;
}
