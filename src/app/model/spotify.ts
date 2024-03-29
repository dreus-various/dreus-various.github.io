import type {Track} from "./track";

export type SearchPlaylistItems = {
  id: string,
  name: string,
  owner: { 'display_name': string, id: string }
  type: string,
  uri: string,
}

export type SearchPlaylists = {
  items: SearchPlaylistItems[],
  limit: number,
  next: string,
  offset: number,
  total: number
}

export type SearchResponse = {
  playlists: SearchPlaylists,
}

export type UserTrackResponse = {
  href: string,
  items: { added_at: string, track: Track }[],
  limit: number,
  next: string,
  offset: number,
  total: number
}
