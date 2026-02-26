// YouTube 채널 목록 설정
// CEO가 채널을 추가/제거하려면 이 배열에 객체를 추가/삭제하면 됨
// channelId는 YouTube 채널 페이지 URL에서 확인: youtube.com/channel/{CHANNEL_ID}

export interface YouTubeFeedSource {
  name: string;
  channelId?: string;
  playlistId?: string;
  lang: "en" | "ko";
  grade: "S" | "A" | "B";
  category: "tutorial" | "news" | "review" | "talk";
}

export const YOUTUBE_CHANNELS: YouTubeFeedSource[] = [
  // === AI/Tech 한국어 채널 ===
  {
    name: "노마드코더",
    channelId: "UCUpJs89fSBXNolQGOYKn0YQ",
    lang: "ko",
    grade: "A",
    category: "tutorial",
  },
  {
    name: "조코딩",
    channelId: "UCQNE2JmbasNYbjGAcuBiRRg",
    lang: "ko",
    grade: "A",
    category: "tutorial",
  },

  // === AI/Tech 영어 채널 ===
  {
    name: "Fireship",
    channelId: "UCsBjURrPoezykLs9EqgamOA",
    lang: "en",
    grade: "S",
    category: "news",
  },
  {
    name: "Two Minute Papers",
    channelId: "UCbfYPyITQ-7l4upoX8nvctg",
    lang: "en",
    grade: "A",
    category: "review",
  },
  {
    name: "AI Explained",
    channelId: "UCNJ1Ymd5yFuUPtn21xtRbbw",
    lang: "en",
    grade: "S",
    category: "news",
  },
  {
    name: "Matt Wolfe",
    channelId: "UCJIfeSCssxSC_Dhc5s7woww",
    lang: "en",
    grade: "A",
    category: "review",
  },
];
