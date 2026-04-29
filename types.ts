export interface ServiceTime {
  name: string;
  time: string;
  location: string;
}

export interface GraceMessage {
  topic: string;
  message: string;
  verse: string;
  reference: string;
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