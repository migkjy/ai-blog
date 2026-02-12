import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI AppPro - AI 활용 블로그",
    short_name: "AI AppPro Blog",
    description: "소상공인과 중소기업을 위한 실전 AI 활용 가이드. AI 도구 리뷰, 업종별 자동화 플레이북, 최신 AI 트렌드.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
