// [한글 코멘트] 예배 안내 시간표 인터페이스 (AI 묵상 생성기 GraceMessage 타입 완전 제거됨)
export interface ServiceTime {
  name: string;
  time: string;
  location: string;
}

export enum NavSection {
  HOME = 'home',
  ABOUT = 'about',
  WORSHIP = 'worship',
  MEDIA = 'media',
  NEWS = 'news',
  BOARD = 'board',
  ALBUM = 'album',
  LOCATION = 'location'
}